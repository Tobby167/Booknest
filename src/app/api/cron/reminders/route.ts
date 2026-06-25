import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendWhatsAppMessage, type WhatsAppIntegrationRow } from "@/services/notifications/whatsappService";
import { sendTelegramMessage, type TelegramIntegrationRow } from "@/services/notifications/telegramService";
import { isoDateOffset } from "@/lib/reminders";

/**
 * GET /api/cron/reminders
 *
 * Called by a cron scheduler (e.g. Vercel Cron or an external service).
 * Secured by a CRON_SECRET header that must match the CRON_SECRET env variable.
 *
 * Finds all appointments tomorrow, checks if those clients have an active
 * WhatsApp or Telegram conversation, and sends reminder messages.
 */
export async function GET(request: NextRequest) {
  const secret = request.headers.get("authorization")?.replace("Bearer ", "");
  const expected = process.env.CRON_SECRET;

  if (!expected || secret !== expected) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  const tomorrow = isoDateOffset(1);

  // Fetch all confirmed/pending appointments for tomorrow across all businesses
  const { data: appointments, error } = await supabase
    .from("appointments")
    .select("id, business_id, client_phone, client_name, start_time, services(name), businesses(slug)")
    .eq("appointment_date", tomorrow)
    .in("status", ["confirmed", "pending", "pending_confirmation"]);

  if (error) {
    console.error("[Cron Reminders] Failed to fetch appointments:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const appt of appointments ?? []) {
    const phone = appt.client_phone as string | null;
    if (!phone) { skipped++; continue; }

    const serviceName = (appt.services as unknown as { name: string } | null)?.name ?? "your appointment";
    const timeStr = appt.start_time as string;
    const [h, m] = timeStr.split(":").map(Number);
    const suffix = h >= 12 ? "PM" : "AM";
    const formattedTime = `${h % 12 || 12}:${String(m).padStart(2, "0")} ${suffix}`;

    const reminderText =
      `⏰ Reminder! Your ${serviceName} appointment is tomorrow at ${formattedTime}.\n\n` +
      `Reply "menu" to manage your booking.`;

    const businessId = appt.business_id as string;

    // Check for WhatsApp conversation
    const { data: waConv } = await supabase
      .from("chat_conversations")
      .select("id, external_chat_id")
      .eq("business_id", businessId)
      .eq("platform", "whatsapp")
      .eq("external_chat_id", phone)
      .maybeSingle();

    if (waConv) {
      const { data: waIntegration } = await supabase
        .from("whatsapp_integrations")
        .select("*")
        .eq("business_id", businessId)
        .eq("is_active", true)
        .maybeSingle();

      if (waIntegration) {
        try {
          await sendWhatsAppMessage(waIntegration as WhatsAppIntegrationRow, phone, reminderText);
          await supabase.from("chat_messages").insert({
            conversation_id: waConv.id,
            business_id: businessId,
            sender: "system",
            body: reminderText
          });
          sent++;
        } catch (e) {
          errors.push(`WA ${phone}: ${e instanceof Error ? e.message : "error"}`);
        }
      }
      continue;
    }

    // Check for Telegram conversation (match by client_phone stored on appointment)
    const { data: tgConv } = await supabase
      .from("chat_conversations")
      .select("id, external_chat_id")
      .eq("business_id", businessId)
      .eq("platform", "telegram")
      .eq("external_chat_id", phone)
      .maybeSingle();

    if (tgConv) {
      const { data: tgIntegration } = await supabase
        .from("telegram_integrations")
        .select("*")
        .eq("business_id", businessId)
        .eq("is_active", true)
        .maybeSingle();

      if (tgIntegration) {
        try {
          await sendTelegramMessage(tgIntegration as TelegramIntegrationRow, tgConv.external_chat_id, reminderText);
          await supabase.from("chat_messages").insert({
            conversation_id: tgConv.id,
            business_id: businessId,
            sender: "system",
            body: reminderText
          });
          sent++;
        } catch (e) {
          errors.push(`TG ${phone}: ${e instanceof Error ? e.message : "error"}`);
        }
      }
      continue;
    }

    skipped++;
  }

  return NextResponse.json({ ok: true, sent, skipped, errors });
}
