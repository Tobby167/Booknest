import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { rateLimit, getRequestKey } from "@/lib/rate-limit";
import {
  validateTelegramSecret,
  parseTelegramMessage,
  sendTelegramMessage,
  type TelegramIntegrationRow
} from "@/services/notifications/telegramService";
import { processMessage, type ConversationState } from "@/services/notifications/bookingAutomation";

export async function POST(request: NextRequest) {
  // Rate limit by IP — 60 requests per minute
  const key = getRequestKey(request, "tg-webhook");
  const { allowed } = rateLimit(key, 60, 60_000);
  if (!allowed) return new NextResponse("Too Many Requests", { status: 429 });

  const secretHeader = request.headers.get("x-telegram-bot-api-secret-token");

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return new NextResponse("Bad Request", { status: 400 });
  }

  // Parse the incoming Telegram message first so we can find the integration
  const incoming = parseTelegramMessage(payload);
  if (!incoming) {
    // Non-text update (photo, sticker, etc.) — acknowledge silently
    return NextResponse.json({ status: "ok" });
  }

  const supabase = createSupabaseAdminClient();

  // We receive the update on a shared path — find integration by secret token
  const { data: integration } = await supabase
    .from("telegram_integrations")
    .select("*, businesses(id, slug)")
    .eq("webhook_secret", secretHeader ?? "")
    .eq("is_active", true)
    .maybeSingle();

  if (!integration) return new NextResponse("Unauthorized", { status: 401 });

  // Validate secret token (constant-time)
  if (!validateTelegramSecret(secretHeader, integration.webhook_secret)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const business = integration.businesses as { id: string; slug: string } | null;
  if (!business) return NextResponse.json({ status: "ok" });

  // Idempotency: skip already-processed message IDs
  const { data: existingMsg } = await supabase
    .from("chat_messages")
    .select("id")
    .eq("external_message_id", String(incoming.messageId))
    .maybeSingle();

  if (existingMsg) return NextResponse.json({ status: "ok" });

  // Upsert conversation
  const { data: conversation, error: convError } = await supabase
    .from("chat_conversations")
    .upsert(
      {
        business_id: business.id,
        platform: "telegram",
        external_chat_id: incoming.chatId,
        client_name: incoming.fromName,
        last_message_at: new Date().toISOString()
      },
      { onConflict: "business_id,platform,external_chat_id" }
    )
    .select("id, state, client_name")
    .single();

  if (convError || !conversation) return NextResponse.json({ status: "ok" });

  // Store incoming message
  await supabase.from("chat_messages").insert({
    conversation_id: conversation.id,
    business_id: business.id,
    sender: "customer",
    body: incoming.text,
    external_message_id: String(incoming.messageId)
  });

  // Run state machine
  const state = (conversation.state ?? { step: "idle" }) as ConversationState;
  const customerName = conversation.client_name ?? incoming.fromName;

  const { reply, newState } = await processMessage(
    supabase,
    business.id,
    business.slug,
    incoming.chatId,
    customerName,
    state,
    incoming.text
  );

  // Update conversation state
  await supabase
    .from("chat_conversations")
    .update({ state: newState, client_name: newState.client_name ?? conversation.client_name, last_message_at: new Date().toISOString() })
    .eq("id", conversation.id);

  // Store system reply
  await supabase.from("chat_messages").insert({
    conversation_id: conversation.id,
    business_id: business.id,
    sender: "system",
    body: reply
  });

  // Send reply to Telegram chat
  try {
    await sendTelegramMessage(integration as TelegramIntegrationRow, incoming.chatId, reply);
  } catch (e) {
    console.error("[Telegram] Failed to send message:", e);
  }

  return NextResponse.json({ status: "ok" });
}
