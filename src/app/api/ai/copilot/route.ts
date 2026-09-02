import { streamText, tool } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Groq client — uses GROQ_API_KEY, falls back to OPENAI_API_KEY for backwards compat
const groq = createOpenAI({
  baseURL: "https://api.groq.com/openai/v1",
  apiKey: process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY || "",
});

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function startOfWeekIso() {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().slice(0, 10);
}

function startOfMonthIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return new Response("Unauthorized", { status: 401 });
    }

    // Resolve business server-side from the authenticated session — never trust AI input
    let { data: business } = await supabase
      .from("businesses")
      .select("id, name, description, phone, email, address, plan, currency, booking_requires_owner_confirmation")
      .eq("owner_id", user.id)
      .maybeSingle();

    if (!business) {
      const fallbackSlug = `business-${user.id.slice(0, 8)}`;
      const { data: newBiz } = await supabase
        .from("businesses")
        .insert({ owner_id: user.id, name: "My Business", slug: fallbackSlug })
        .select("id, name, description, phone, email, address, plan, currency, booking_requires_owner_confirmation")
        .maybeSingle();
      business = newBiz;
    }

    if (!business) {
      return new Response("Could not resolve business", { status: 500 });
    }

    const businessId = business.id;
    const { messages } = await req.json();

    const isPaid = ["growth", "pro", "business"].includes((business as any).plan || "");
    const chatModel = isPaid ? "openai/gpt-oss-120b" : "openai/gpt-oss-20b";

    const systemPrompt = isPaid
      ? `You are BookNest Copilot — the business owner's premium AI personal assistant built into their BookNest dashboard.

You have FULL read access to the owner's business data through your tools. Use them proactively whenever a question relates to real business data.

Your capabilities:
- get_business_overview → business profile + key stats at a glance
- get_appointments → view appointments (today / upcoming / pending / completed / all)
- get_services → view all services and prices
- get_clients → view client list
- get_revenue_stats → revenue breakdown by period (today / this_week / this_month / all_time)
- save_services → add new services to the business

Rules:
1. Be conversational, friendly and concise. Don't ramble.
2. When the owner asks anything about their business data, ALWAYS call the relevant tool first — never guess or make up numbers.
3. After fetching data, summarize it clearly. Highlight anything that needs attention (e.g. pending payments, unconfirmed appointments).
4. You only ever see data for THIS owner's business. You cannot access any other business.
5. If asked to do something you do not have a tool for (e.g. delete data), politely say you can only read data for now.
6. Make every reply easy to scan on a phone: use a short opening sentence, then 3-6 bullets when useful. Put a blank line between sections. Do not send a long wall of text or repeat your full capability list unless the owner specifically asks for it.
7. Use simple Markdown only: short headings (###), bullet lists (-), and bold for important values (**value**). Do not use tables.`
      : `You are BookNest Copilot — the business owner's onboarding assistant.
You are running on the Starter (Free) plan.

Your capabilities:
- save_services → help the owner add new services to their business

Strict Rules for Free Plan:
1. You DO NOT have access to revenue, appointments, clients, or overview statistics.
2. If the owner asks about scheduling, calendar, appointments, clients, or earnings/revenue, you MUST decline and politely prompt them to upgrade their BookNest subscription.
   Example upgrade prompt: "To view your revenue analysis and scheduling insights, upgrade to our BookNest Growth or Pro plan! Let me know if you'd like to adjust your services in the meantime."
3. Keep responses conversational, concise, and easy to scan on a phone. Use a short opening sentence and no more than 3-5 bullets when useful. Put a blank line between sections; never send a wall of text.`;

    // Tools defined as variables
    const getBusinessOverviewTool = tool({
      description:
        "Fetches the business profile and a summary of key stats. Call this when the owner asks about their business in general, or asks for a summary.",
      parameters: z.object({}),
      execute: async () => {
        try {
          const { data: rows } = await supabase
            .from("appointments")
            .select("status, payment_status, total_price, appointment_date")
            .eq("business_id", businessId);

          const appts = rows ?? [];
          const today = todayIso();

          return {
            business: {
              name: business!.name,
              description: business!.description ?? "Not set",
              phone: business!.phone ?? "Not set",
              email: business!.email ?? "Not set",
              address: business!.address ?? "Not set",
              plan: (business! as Record<string, unknown>).plan ?? "starter",
              currency: (business! as Record<string, unknown>).currency ?? "NGN",
              requiresConfirmation: business!.booking_requires_owner_confirmation,
            },
            stats: {
              totalAppointments: appts.length,
              todaysAppointments: appts.filter((r) => r.appointment_date === today).length,
              upcomingAppointments: appts.filter(
                (r) =>
                  r.appointment_date >= today &&
                  !["cancelled", "completed", "no_show"].includes(r.status)
              ).length,
              pendingConfirmation: appts.filter((r) => r.status === "pending_confirmation").length,
              completedAppointments: appts.filter((r) => r.status === "completed").length,
              confirmedRevenue: appts
                .filter((r) => r.payment_status === "confirmed")
                .reduce((sum, r) => sum + Number(r.total_price ?? 0), 0),
              receiptsAwaitingReview: appts.filter((r) => r.payment_status === "receipt_uploaded").length,
            },
          };
        } catch (err) {
          console.error("get_business_overview error:", err);
          return { error: "Failed to fetch business overview." };
        }
      },
    });

    const getAppointmentsTool = tool({
      description:
        "Fetches appointments for this business. filter must be one of: today, upcoming, pending, completed, all. limit is a number between 1-20.",
      parameters: z.object({
        filter: z.string().describe("Which appointments to fetch: today | upcoming | pending | completed | all"),
        limit: z.number().describe("Max results to return, between 1 and 20"),
      }),
      execute: async ({ filter, limit }: { filter: string; limit: number }) => {
        const safeFilter = ["today","upcoming","pending","completed","all"].includes(filter) ? filter : "upcoming";
        const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 20);
        try {
          const today = todayIso();

          let query = supabase
            .from("appointments")
            .select("id, client_name, client_phone, service_id, appointment_date, start_time, end_time, status, payment_status, total_price, notes")
            .eq("business_id", businessId)
            .order("appointment_date", { ascending: true })
            .order("start_time", { ascending: true })
            .limit(safeLimit);

          if (safeFilter === "today") {
            query = query.eq("appointment_date", today);
          } else if (safeFilter === "upcoming") {
            query = query
              .gte("appointment_date", today)
              .not("status", "in", '("cancelled","completed","no_show")');
          } else if (safeFilter === "pending") {
            query = query.in("status", ["pending", "pending_confirmation"]);
          } else if (safeFilter === "completed") {
            query = query.eq("status", "completed");
          }

          const { data: appts, error: apptErr } = await query;
          if (apptErr) return { error: apptErr.message };

          const serviceIds = [...new Set((appts ?? []).map((a) => a.service_id).filter(Boolean))] as string[];
          const serviceMap: Record<string, string> = {};

          if (serviceIds.length > 0) {
            const { data: services } = await supabase
              .from("services")
              .select("id, name")
              .in("id", serviceIds);
            (services ?? []).forEach((s) => { serviceMap[s.id] = s.name; });
          }

          return {
            count: appts?.length ?? 0,
            appointments: (appts ?? []).map((a) => ({
              client: a.client_name,
              phone: a.client_phone ?? "N/A",
              date: a.appointment_date,
              time: `${a.start_time} – ${a.end_time}`,
              service: a.service_id ? (serviceMap[a.service_id] ?? "Unknown service") : "N/A",
              status: a.status,
              paymentStatus: a.payment_status,
              price: a.total_price ?? 0,
              notes: a.notes ?? "",
            })),
          };
        } catch (err) {
          console.error("get_appointments error:", err);
          return { error: "Failed to fetch appointments." };
        }
      },
    });

    const getServicesTool = tool({
      description:
        "Fetches all services this business offers with their prices, duration, and categories.",
      parameters: z.object({}),
      execute: async () => {
        try {
          const { data: services, error: sErr } = await supabase
            .from("services")
            .select("id, name, description, base_price, price_type, duration_minutes, is_active, category_id")
            .eq("business_id", businessId)
            .order("display_order", { ascending: true });

          if (sErr) return { error: sErr.message };

          const catIds = [...new Set((services ?? []).map((s) => s.category_id).filter(Boolean))] as string[];
          const catMap: Record<string, string> = {};

          if (catIds.length > 0) {
            const { data: cats } = await supabase
              .from("service_categories")
              .select("id, name")
              .in("id", catIds);
            (cats ?? []).forEach((c) => { catMap[c.id] = c.name; });
          }

          return {
            count: services?.length ?? 0,
            services: (services ?? []).map((s) => ({
              name: s.name,
              description: s.description ?? "",
              price: s.base_price ?? 0,
              priceType: s.price_type,
              durationMinutes: s.duration_minutes ?? 0,
              category: s.category_id ? (catMap[s.category_id] ?? "Uncategorised") : "Uncategorised",
              isActive: s.is_active,
            })),
          };
        } catch (err) {
          console.error("get_services error:", err);
          return { error: "Failed to fetch services." };
        }
      },
    });

    const getClientsTool = tool({
      description: "Fetches the client list for this business. limit is a number between 1-50.",
      parameters: z.object({
        limit: z.number().describe("Max number of clients to return, between 1 and 50"),
      }),
      execute: async ({ limit }: { limit: number }) => {
        const safeLimit = Math.min(Math.max(Number(limit) || 15, 1), 50);
        try {
          const { data: clients, error } = await supabase
            .from("clients")
            .select("id, name, email, phone, client_type, is_approved, created_at")
            .eq("business_id", businessId)
            .order("created_at", { ascending: false })
            .limit(safeLimit);

          if (error) return { error: error.message };

          return {
            count: clients?.length ?? 0,
            clients: (clients ?? []).map((c) => ({
              name: c.name,
              email: c.email ?? "N/A",
              phone: c.phone ?? "N/A",
              type: (c as Record<string, unknown>).client_type ?? "regular",
              approved: (c as Record<string, unknown>).is_approved ?? false,
              joinedAt: c.created_at?.slice(0, 10),
            })),
          };
        } catch (err) {
          console.error("get_clients error:", err);
          return { error: "Failed to fetch clients." };
        }
      },
    });

    const getRevenueStatsTool = tool({
      description:
        "Returns revenue statistics broken down by period. Use when the owner asks about money, earnings, income, or revenue. period must be: today | this_week | this_month | all_time.",
      parameters: z.object({
        period: z.string().describe("Time period: today | this_week | this_month | all_time"),
      }),
      execute: async ({ period }: { period: string }) => {
        const safePeriod = ["today","this_week","this_month","all_time"].includes(period) ? period : "this_month";
        try {
          let query = supabase
            .from("appointments")
            .select("payment_status, total_price, appointment_date, status")
            .eq("business_id", businessId);

          if (safePeriod === "today") query = query.eq("appointment_date", todayIso());
          else if (safePeriod === "this_week") query = query.gte("appointment_date", startOfWeekIso());
          else if (safePeriod === "this_month") query = query.gte("appointment_date", startOfMonthIso());

          const { data, error } = await query;
          if (error) return { error: error.message };

          const rows = data ?? [];

          const confirmedRevenue = rows
            .filter((r) => r.payment_status === "confirmed")
            .reduce((sum, r) => sum + Number(r.total_price ?? 0), 0);

          const pendingRevenue = rows
            .filter((r) => ["pending", "receipt_uploaded"].includes(r.payment_status))
            .reduce((sum, r) => sum + Number(r.total_price ?? 0), 0);

          return {
            period,
            confirmedRevenue,
            pendingRevenue,
            paidAppointments: rows.filter((r) => r.payment_status === "confirmed").length,
            unpaidAppointments: rows.filter((r) => ["pending", "receipt_uploaded"].includes(r.payment_status)).length,
            receiptsAwaitingReview: rows.filter((r) => r.payment_status === "receipt_uploaded").length,
            totalAppointmentsInPeriod: rows.length,
          };
        } catch (err) {
          console.error("get_revenue_stats error:", err);
          return { error: "Failed to fetch revenue stats." };
        }
      },
    });

    const saveServicesTool = tool({
      description:
        "Saves a new list of services and categories into the business. Use when the owner wants to add new services.",
      parameters: z.object({
        categories: z.array(
          z.object({
            name: z.string().describe("Category name, e.g. Haircuts"),
            description: z.string().describe("Brief description"),
          })
        ),
        services: z.array(
          z.object({
            name: z.string().describe("Service name"),
            price: z.number().describe("Price in numbers"),
            duration: z.number().describe("Duration in minutes"),
            category_name: z.string().describe("Category this belongs to"),
          })
        ),
      }),
      execute: async ({ categories, services }) => {
        try {
          const categoryMap: Record<string, string> = {};

          for (const cat of categories) {
            const { data: newCat } = await supabase
              .from("service_categories")
              .insert({
                business_id: businessId,
                name: cat.name,
                description: cat.description,
              })
              .select("id")
              .single();

            if (newCat) categoryMap[cat.name] = newCat.id;
          }

          for (const srv of services) {
            await supabase.from("services").insert({
              business_id: businessId,
              category_id: categoryMap[srv.category_name] ?? null,
              name: srv.name,
              description: "Automatically created by BookNest Copilot.",
              base_price: srv.price,        // correct column: base_price
              duration_minutes: srv.duration, // correct column: duration_minutes
              is_active: true,
            });
          }

          return "Successfully saved services to the database.";
        } catch (err) {
          console.error("save_services error:", err);
          return "Failed to save services due to an error.";
        }
      },
    });

    // Compile active tools dynamically based on plan
    const activeTools: Record<string, any> = {};
    if (isPaid) {
      activeTools.get_business_overview = getBusinessOverviewTool;
      activeTools.get_appointments = getAppointmentsTool;
      activeTools.get_services = getServicesTool;
      activeTools.get_clients = getClientsTool;
      activeTools.get_revenue_stats = getRevenueStatsTool;
    }
    activeTools.save_services = saveServicesTool;

    // Per-day external_chat_id — one conversation per business per day
    const todayDate = new Date().toISOString().slice(0, 10);
    const externalChatId = `copilot-${businessId}-${todayDate}`;

    // Capture the last user message to persist it
    const lastUserMessage = [...messages].reverse().find((m: any) => m.role === "user");
    const userText = typeof lastUserMessage?.content === "string"
      ? lastUserMessage.content
      : Array.isArray(lastUserMessage?.content)
        ? (lastUserMessage.content as any[]).filter((p: any) => p.type === "text").map((p: any) => p.text).join("")
        : "";

    try {
      const result = await streamText({
        model: groq(chatModel),
        system: systemPrompt,
        messages,
        maxSteps: 5,
        tools: activeTools,
        onError: (event) => {
          console.error("[Copilot streamText error]", event.error);
        },
        onFinish: async ({ text }) => {
          try {
            // Upsert conversation row (one per business per day)
            const { data: convo } = await supabase
              .from("chat_conversations")
              .upsert(
                {
                  business_id: businessId,
                  platform: "copilot",
                  external_chat_id: externalChatId,
                  client_name: business!.name + " (Dashboard)",
                  last_message_at: new Date().toISOString(),
                },
                { onConflict: "business_id,platform,external_chat_id" }
              )
              .select("id")
              .throwOnError()
              .maybeSingle();

            const conversationId = convo?.id;
            if (!conversationId) {
              console.warn("[Copilot] Could not resolve conversation ID from upsert");
              return;
            }

            // Save user message
            if (userText) {
              await supabase.from("chat_messages").insert({
                conversation_id: conversationId,
                business_id: businessId,
                sender: "customer",
                body: userText,
              }).throwOnError();
            }

            // Save AI reply
            if (text) {
              await supabase.from("chat_messages").insert({
                conversation_id: conversationId,
                business_id: businessId,
                sender: "system",
                body: text,
              }).throwOnError();
            }
          } catch (persistErr) {
            // Don't crash the stream if persistence fails
            console.error("[Copilot] Failed to persist messages:", persistErr);
          }
        },

      });

      return result.toDataStreamResponse();
    } catch (apiError) {
      console.warn("AI Copilot API failed, running offline failsafe fallback:", apiError);
      return getOfflineFailsafeResponse(messages, businessId, supabase);
    }

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    console.error("Copilot POST Error:", error);
    return new Response(message, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// OFFLINE FAILSAFE SYSTEM
// ─────────────────────────────────────────────────────────────────────────────

async function getOfflineFailsafeResponse(messages: any[], businessId: string, supabase: any) {
  const lastUserMessage = messages.filter(m => m.role === 'user').pop()?.content || "";
  const text = await generateOfflineResponse(lastUserMessage, businessId, supabase);
  
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      // Stream the mock text response packaged in the AI SDK v4 Data Stream protocol format
      controller.enqueue(encoder.encode(`0:${JSON.stringify(text + "\n")}\n`));
      controller.close();
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "x-vercel-ai-data-stream": "v1"
    }
  });
}

async function generateOfflineResponse(prompt: string, businessId: string, supabase: any): Promise<string> {
  const query = prompt.toLowerCase();

  // 1. REVENUE / EARNINGS KEYWORDS
  if (query.includes("revenue") || query.includes("money") || query.includes("earn") || query.includes("income") || query.includes("finance")) {
    try {
      const { data: rows } = await supabase
        .from("appointments")
        .select("payment_status, total_price")
        .eq("business_id", businessId);

      const appts = rows ?? [];
      const confirmedRevenue = appts
        .filter((r: any) => r.payment_status === "confirmed")
        .reduce((sum: number, r: any) => sum + Number(r.total_price ?? 0), 0);
      const pendingRevenue = appts
        .filter((r: any) => ["pending", "receipt_uploaded"].includes(r.payment_status))
        .reduce((sum: number, r: any) => sum + Number(r.total_price ?? 0), 0);

      return `⚠️ **[Offline Failsafe Mode]** The AI provider is overloaded right now. Here is your financial summary directly from your database:

- **Confirmed Revenue:** NGN ${confirmedRevenue}
- **Pending Revenue:** NGN ${pendingRevenue}
- **Awaiting Receipt Review:** ${appts.filter((r: any) => r.payment_status === "receipt_uploaded").length} bookings`;
    } catch (e) {
      return `⚠️ **[Offline Failsafe Mode]** Failed to query revenue data locally.`;
    }
  }

  // 2. APPOINTMENTS KEYWORDS
  if (query.includes("appointment") || query.includes("booking") || query.includes("today") || query.includes("schedule") || query.includes("upcoming")) {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const { data: appts } = await supabase
        .from("appointments")
        .select("client_name, appointment_date, start_time, end_time, status")
        .eq("business_id", businessId)
        .gte("appointment_date", today)
        .not("status", "in", '("cancelled","completed","no_show")')
        .order("appointment_date", { ascending: true })
        .order("start_time", { ascending: true })
        .limit(5);

      if (!appts || appts.length === 0) {
        return `⚠️ **[Offline Failsafe Mode]** No upcoming appointments found in your schedule.`;
      }

      const list = appts.map((a: any) => `- **${a.client_name}** on ${a.appointment_date} at ${a.start_time.slice(0,5)} [${a.status}]`).join("\n");
      return `⚠️ **[Offline Failsafe Mode]** The AI provider is overloaded. Here are your next 5 upcoming appointments directly from your calendar:

${list}`;
    } catch (e) {
      return `⚠️ **[Offline Failsafe Mode]** Failed to query appointments data locally.`;
    }
  }

  // 3. SERVICES KEYWORDS
  if (query.includes("service") || query.includes("price") || query.includes("offer") || query.includes("catalog")) {
    try {
      const { data: services } = await supabase
        .from("services")
        .select("name, base_price, duration_minutes, is_active")
        .eq("business_id", businessId)
        .order("display_order", { ascending: true });

      if (!services || services.length === 0) {
        return `⚠️ **[Offline Failsafe Mode]** No services found.`;
      }

      const list = services.map((s: any) => `- **${s.name}**: NGN ${s.base_price ?? 0} (${s.duration_minutes ?? 0} mins) [${s.is_active ? "Active" : "Inactive"}]`).join("\n");
      return `⚠️ **[Offline Failsafe Mode]** Here is your current service list:

${list}`;
    } catch (e) {
      return `⚠️ **[Offline Failsafe Mode]** Failed to query services data locally.`;
    }
  }

  // 4. CLIENTS KEYWORDS
  if (query.includes("client") || query.includes("customer")) {
    try {
      const { data: clients } = await supabase
        .from("clients")
        .select("name, email, phone, client_type")
        .eq("business_id", businessId)
        .limit(10);

      if (!clients || clients.length === 0) {
        return `⚠️ **[Offline Failsafe Mode]** No clients found.`;
      }

      const list = clients.map((c: any) => `- **${c.name}** (${c.client_type}) - ${c.phone ?? "No phone"}`).join("\n");
      return `⚠️ **[Offline Failsafe Mode]** Here is your client list (showing up to 10):

${list}`;
    } catch (e) {
      return `⚠️ **[Offline Failsafe Mode]** Failed to query clients data locally.`;
    }
  }

  // 5. DEFAULT FALLBACK
  return `⚠️ **[Offline Failsafe Mode]** The AI provider is overloaded right now. 

I can still check your database locally! Try asking me about:
- **Revenue** (e.g. "show revenue")
- **Appointments** (e.g. "what is my schedule?")
- **Services** (e.g. "what are my prices?")
- **Clients** (e.g. "list my clients")`;
}
