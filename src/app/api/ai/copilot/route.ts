import { streamText, tool } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const groq = createOpenAI({
  baseURL: "https://api.groq.com/openai/v1",
  apiKey: process.env.OPENAI_API_KEY || "", // Using Groq API key stored here
});

const systemPrompt = `You are BookNest Copilot, an expert business strategist and onboarding assistant.
Your goal is to help the business owner figure out what services they should offer, how to price them, and then save them to their account.
1. Be extremely conversational, friendly, and helpful. Keep responses concise (under 3 sentences unless listing ideas).
2. If the user tells you their business type, brainstorm 3-4 excellent service ideas with prices and durations.
3. Once the user is happy with the services and explicitly agrees to add them to their profile, call the 'save_services' tool.
4. After calling 'save_services', tell the user "I've successfully added these services to your BookNest profile! Check out your Services tab."`;

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { data: business } = await supabase
      .from("businesses")
      .select("id")
      .eq("owner_id", user.id)
      .maybeSingle();

    if (!business) {
      return new Response("Business not found. Create a profile first.", { status: 400 });
    }

    const { messages } = await req.json();

    const result = streamText({
      model: groq("llama-3.3-70b-versatile"),
      system: systemPrompt,
      messages,
      tools: {
        save_services: tool({
          description: "Saves the finalized list of services and categories into the user's BookNest database.",
          parameters: z.object({
            categories: z.array(z.object({
              name: z.string().describe("Name of the category, e.g. Haircuts"),
              description: z.string().describe("Brief description of the category")
            })),
            services: z.array(z.object({
              name: z.string().describe("Name of the service"),
              price: z.number().describe("Price of the service in numbers"),
              duration: z.number().describe("Duration in minutes"),
              category_name: z.string().describe("The name of the category this belongs to")
            }))
          }),
          // @ts-ignore - Vercel AI SDK zod type inference issue
          execute: async (args) => {
            const { categories, services } = args;
            try {
              // 1. Insert Categories
              const categoryMap: Record<string, string> = {};
              for (const cat of categories) {
                const { data: newCat } = await supabase
                  .from("service_categories")
                  .insert({
                    business_id: business.id,
                    name: cat.name,
                    description: cat.description,
                  })
                  .select("id")
                  .single();
                
                if (newCat) categoryMap[cat.name] = newCat.id;
              }

              // 2. Insert Services
              for (const srv of services) {
                const categoryId = categoryMap[srv.category_name] || null;
                await supabase
                  .from("services")
                  .insert({
                    business_id: business.id,
                    category_id: categoryId,
                    name: srv.name,
                    description: `Automatically created by BookNest Copilot.`,
                    price: srv.price,
                    duration: srv.duration,
                    is_active: true
                  });
              }
              return "Successfully saved services to the database.";
            } catch (err: any) {
              console.error("Failed to save services:", err);
              return "Failed to save services to the database due to an error.";
            }
          }
        })
      }
    });

    // @ts-ignore - Broken generic inference due to execute bypass
    return result.toDataStreamResponse();
  } catch (error: any) {
    console.error("Copilot Error:", error);
    return new Response(error.message, { status: 500 });
  }
}
