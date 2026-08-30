import { streamText, tool } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { generateAvailableSlots } from "@/lib/booking/availability";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sendPlatformWhatsAppMessage } from "@/services/notifications/whatsappService";
import { buildManualMessage } from "@/services/notifications/manualWhatsAppService";

export const runtime = "nodejs";

const groq = createOpenAI({
  baseURL: "https://api.groq.com/openai/v1",
  apiKey: process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY || "",
});

export async function POST(req: Request) {
  try {
    const { messages, businessSlug } = await req.json();

    if (!businessSlug) {
      return new Response("businessSlug is required", { status: 400 });
    }

    let supabase: any;
    let admin: any;
    try {
      admin = createSupabaseAdminClient();
      supabase = admin;
    } catch {
      supabase = await createSupabaseServerClient();
      admin = supabase;
    }

    // Resolve business
    const { data: business, error: bizErr } = await supabase
      .from("businesses")
      .select("id, name, slug, description, phone, email, address, currency, timezone, booking_notice_hours, max_advance_booking_days, default_buffer_after_minutes, cancellation_policy")
      .eq("slug", businessSlug)
      .maybeSingle();

    if (bizErr || !business) {
      return new Response("Business not found", { status: 404 });
    }

    const businessId = business.id;
    const currencyCode = business.currency || "USD";
    const today = new Date().toISOString().slice(0, 10);

    const systemPrompt = `You are the autonomous AI Booking Assistant for "${business.name}" (${business.description || "Service Provider"}).
Today's date is ${today}. Timezone is ${business.timezone || "UTC"}.
Currency: ${currencyCode}.

Your objective is to help clients book appointments conversationally through a smooth multi-step agentic loop:
1. Discover Services: Understand what the client wants. Use the \`get_services\` tool to check the exact catalog, descriptions, durations, and pricing.
2. Check Live Availability: When the client mentions a day or time (e.g. "tomorrow", "next Tuesday", "Saturday afternoon"), use the \`check_available_slots\` tool for the chosen service and date (format YYYY-MM-DD) to see REAL open slots.
3. Collect Client Details: Ask for their Full Name, Email, and Phone Number (required for booking confirmation and reminders).
4. Confirm and Execute Booking: Summarize the details (Service, Date, Time, Price, Client Name, Email, Phone) and call the \`create_appointment\` tool to finalize the booking in the calendar.

Strict Rules:
- NEVER make up fake available slots. ALWAYS call \`check_available_slots\` with a real YYYY-MM-DD date.
- Be warm, concise, and professional.
- When suggesting times, present 3-5 convenient slots (e.g. Morning, Afternoon).
- Once \`create_appointment\` completes successfully, congratulate the client, give them their appointment confirmation details, and let them know a confirmation has been saved.`;

    // ─────────────────────────────────────────────────────────────────────────
    // TOOL 1: GET SERVICES
    // ─────────────────────────────────────────────────────────────────────────
    const getServicesTool = tool({
      description: "Fetches all active services and categories offered by this business with pricing and duration in minutes.",
      parameters: z.object({}),
      execute: async () => {
        try {
          const [catRes, srvRes] = await Promise.all([
            supabase.from("service_categories").select("id, name, description").eq("business_id", businessId).eq("is_active", true).order("display_order"),
            supabase.from("services").select("id, category_id, name, description, base_price, price_type, duration_minutes").eq("business_id", businessId).eq("is_active", true).order("display_order"),
          ]);

          const categories = catRes.data ?? [];
          const services = srvRes.data ?? [];

          return {
            currency: currencyCode,
            services: services.map((s) => ({
              id: s.id,
              name: s.name,
              description: s.description ?? "",
              price: s.base_price ?? 0,
              priceType: s.price_type,
              durationMinutes: s.duration_minutes ?? 60,
              category: categories.find((c) => c.id === s.category_id)?.name ?? "General",
            })),
          };
        } catch (err: any) {
          console.error("[BookingAgent] get_services error:", err);
          return { error: "Failed to load services." };
        }
      },
    });

    // ─────────────────────────────────────────────────────────────────────────
    // TOOL 2: CHECK AVAILABLE SLOTS
    // ─────────────────────────────────────────────────────────────────────────
    const checkAvailableSlotsTool = tool({
      description: "Checks real-time open appointment time slots for a given service and date (YYYY-MM-DD).",
      parameters: z.object({
        serviceId: z.string().describe("The ID of the chosen service"),
        date: z.string().describe("Date in YYYY-MM-DD format (e.g. 2026-09-02)"),
      }),
      execute: async ({ serviceId, date }: { serviceId: string; date: string }) => {
        try {
          const [serviceResult, availabilityResult, blockedResult, blockedTimeResult, bookedResult] = await Promise.all([
            supabase.from("services").select("*").eq("id", serviceId).eq("business_id", businessId).eq("is_active", true).maybeSingle(),
            supabase.from("availability").select("*").eq("business_id", businessId),
            admin.from("blocked_dates").select("id,business_id,date").eq("business_id", businessId),
            admin.from("blocked_times").select("id,business_id,date,start_time,end_time").eq("business_id", businessId).eq("date", date),
            admin.rpc("get_booked_appointment_ranges", { p_business_slug: businessSlug, p_date: date })
          ]);

          if (!serviceResult.data) {
            return { error: "Service not found or inactive." };
          }

          const slots = generateAvailableSlots({
            date,
            service: serviceResult.data,
            option: null,
            addons: [],
            availability: availabilityResult.data ?? [],
            blockedDates: blockedResult.data ?? [],
            blockedTimes: blockedTimeResult.data ?? [],
            bookedRanges: bookedResult.data ?? [],
            bookingNoticeHours: business.booking_notice_hours ?? 0,
            maxAdvanceBookingDays: business.max_advance_booking_days ?? 90,
            defaultBufferAfterMinutes: business.default_buffer_after_minutes ?? 0
          });

          return {
            date,
            serviceName: serviceResult.data.name,
            durationMinutes: serviceResult.data.duration_minutes,
            availableSlotsCount: slots.length,
            availableSlots: slots.slice(0, 15), // Return first 15 open slots
          };
        } catch (err: any) {
          console.error("[BookingAgent] check_available_slots error:", err);
          return { error: "Failed to check slots for this date." };
        }
      },
    });

    // ─────────────────────────────────────────────────────────────────────────
    // TOOL 3: CREATE APPOINTMENT
    // ─────────────────────────────────────────────────────────────────────────
    const createAppointmentTool = tool({
      description: "Creates and confirms an appointment in the database once the client has agreed to the service, date, time, and provided their name, email, and phone.",
      parameters: z.object({
        serviceId: z.string().describe("The ID of the chosen service"),
        appointmentDate: z.string().describe("Date in YYYY-MM-DD format"),
        startTime: z.string().describe("Start time in HH:MM format (e.g. 14:00)"),
        clientName: z.string().describe("Full name of the client"),
        clientEmail: z.string().describe("Email address of the client"),
        clientPhone: z.string().describe("Phone number of the client"),
        notes: z.string().describe("Any special notes or client requests (pass empty string if none)"),
      }),
      execute: async (args: {
        serviceId: string;
        appointmentDate: string;
        startTime: string;
        clientName: string;
        clientEmail: string;
        clientPhone: string;
        notes?: string;
      }) => {
        try {
          const { data, error } = await admin.rpc("create_public_booking", {
            p_business_slug: businessSlug,
            p_service_id: args.serviceId,
            p_service_option_id: null,
            p_addon_ids: [],
            p_appointment_date: args.appointmentDate,
            p_start_time: args.startTime,
            p_client_name: args.clientName,
            p_client_email: args.clientEmail,
            p_client_phone: args.clientPhone,
            p_notes: args.notes ? `[Booked via AI Agent] ${args.notes}` : "[Booked via AI Agent]",
            p_receipt_image_url: null,
            p_form_answers: [],
          });

          if (error) {
            console.error("[BookingAgent] RPC error:", error);
            return { success: false, error: "The selected time slot is no longer available. Please choose another time." };
          }

          const booking = data as Record<string, any>;
          const appointmentId = booking.appointment_id;

          // Attempt notification dispatch if configured
          try {
            if (args.clientPhone) {
              await sendPlatformWhatsAppMessage({
                businessId: business.id,
                recipientPhone: args.clientPhone,
                clientName: args.clientName,
                serviceName: booking.service_name || "Appointment",
                appointmentDate: args.appointmentDate,
                startTime: args.startTime,
                manualBody: buildManualMessage("booked", {
                  clientName: args.clientName,
                  businessName: business.name,
                  serviceName: booking.service_name || "Appointment",
                  date: args.appointmentDate,
                  time: args.startTime,
                  portalUrl: `${process.env.NEXT_PUBLIC_SITE_URL || "https://booknest-ashy.vercel.app"}/book/${businessSlug}`,
                }),
              });
            }
          } catch (notifyErr) {
            console.warn("[BookingAgent] WhatsApp notify error (ignored):", notifyErr);
          }

          return {
            success: true,
            appointmentId,
            clientName: args.clientName,
            appointmentDate: args.appointmentDate,
            startTime: args.startTime,
            totalPrice: booking.total_price ?? 0,
            currency: currencyCode,
            status: booking.status || "confirmed",
            message: `Appointment successfully created for ${args.clientName} on ${args.appointmentDate} at ${args.startTime}.`,
          };
        } catch (err: any) {
          console.error("[BookingAgent] create_appointment error:", err);
          return { success: false, error: "Failed to create appointment." };
        }
      },
    });

    const activeTools = {
      get_services: getServicesTool,
      check_available_slots: checkAvailableSlotsTool,
      create_appointment: createAppointmentTool,
    };

    const result = await streamText({
      model: groq("openai/gpt-oss-120b"),
      system: systemPrompt,
      messages,
      maxSteps: 6,
      tools: activeTools,
      onError: (event) => {
        console.error("[BookingAgent streamText error]", event.error);
      },
    });

    return result.toDataStreamResponse();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    console.error("[BookingAgent API Error]:", error);
    return new Response(message, { status: 500 });
  }
}
