import { NextRequest } from "next/server";
import { ok, fail, requireUser, requireOwnedBusiness } from "@/lib/api";
import { sendWhatsAppMessage, type WhatsAppIntegrationRow } from "@/services/notifications/whatsappService";
import { sendTelegramMessage, type TelegramIntegrationRow } from "@/services/notifications/telegramService";

// GET /api/dashboard/integrations/conversations
// Returns all conversations for the business with their latest message preview
export async function GET(request: NextRequest) {
  const { supabase, response } = await requireUser();
  if (response) return response;
  const { business, response: bizResp } = await requireOwnedBusiness(supabase);
  if (bizResp) return bizResp;

  const { searchParams } = new URL(request.url);
  const conversationId = searchParams.get("id");

  // Single conversation messages view
  if (conversationId) {
    const { data: messages, error } = await supabase
      .from("chat_messages")
      .select("id, sender, body, external_message_id, created_at")
      .eq("conversation_id", conversationId)
      .eq("business_id", business!.id)
      .order("created_at", { ascending: true });

    if (error) return fail("Failed to fetch messages.", 500);
    return ok({ messages: messages ?? [] });
  }

  // Conversations list view
  const { data: conversations, error } = await supabase
    .from("chat_conversations")
    .select("id, platform, external_chat_id, client_name, state, last_message_at, created_at")
    .eq("business_id", business!.id)
    .order("last_message_at", { ascending: false })
    .limit(100);

  if (error) return fail("Failed to fetch conversations.", 500);
  return ok({ conversations: conversations ?? [] });
}

// POST /api/dashboard/integrations/conversations
// Send a manual reply from the dashboard to a customer
export async function POST(request: NextRequest) {
  const { supabase, response } = await requireUser();
  if (response) return response;
  const { business, response: bizResp } = await requireOwnedBusiness(supabase);
  if (bizResp) return bizResp;

  let body: { conversation_id: string; message: string };
  try {
    body = await request.json();
  } catch {
    return fail("Invalid request body.", 400);
  }

  const { conversation_id, message } = body;
  if (!conversation_id || !message?.trim()) return fail("conversation_id and message are required.", 400);

  // Fetch conversation to get platform + external_chat_id
  const { data: conversation } = await supabase
    .from("chat_conversations")
    .select("id, platform, external_chat_id, business_id")
    .eq("id", conversation_id)
    .eq("business_id", business!.id)
    .maybeSingle();

  if (!conversation) return fail("Conversation not found.", 404);

  // Store the message
  await supabase.from("chat_messages").insert({
    conversation_id: conversation.id,
    business_id: business!.id,
    sender: "system",
    body: message.trim()
  });

  await supabase
    .from("chat_conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", conversation.id);

  // Dispatch via the correct platform
  if (conversation.platform === "whatsapp") {
    const { data: integration } = await supabase
      .from("whatsapp_integrations")
      .select("*")
      .eq("business_id", business!.id)
      .maybeSingle();

    if (!integration) return fail("WhatsApp integration not connected.", 400);
    try {
      await sendWhatsAppMessage(integration as WhatsAppIntegrationRow, conversation.external_chat_id, message.trim());
    } catch (e) {
      return fail(e instanceof Error ? e.message : "Failed to send WhatsApp message.", 500);
    }
  } else if (conversation.platform === "telegram") {
    const { data: integration } = await supabase
      .from("telegram_integrations")
      .select("*")
      .eq("business_id", business!.id)
      .maybeSingle();

    if (!integration) return fail("Telegram integration not connected.", 400);
    try {
      await sendTelegramMessage(integration as TelegramIntegrationRow, conversation.external_chat_id, message.trim());
    } catch (e) {
      return fail(e instanceof Error ? e.message : "Failed to send Telegram message.", 500);
    }
  }

  return ok({ success: true });
}
