import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { rateLimit, getRequestKey } from "@/lib/rate-limit";
import { getPlatformWhatsApp } from "@/lib/env";
import {
  verifyWhatsAppWebhook,
  validatePlatformWhatsAppSignature,
  parseWhatsAppMessage,
  sendPlatformWhatsAppMessage
} from "@/services/notifications/whatsappService";
import { processMessage, type ConversationState } from "@/services/notifications/bookingAutomation";

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Customers start a conversation by sending "START {businessSlug}".
 * e.g.  "START blissart"  or  "start blissart"  (case-insensitive)
 * Business owners share a pre-filled wa.me link so this happens automatically.
 */
const START_REGEX = /^start\s+([a-z0-9_-]+)$/i;

const UNKNOWN_BUSINESS_REPLY =
  "👋 Welcome to BookNest!\n\n" +
  "To get started, please use the booking link your service provider shared with you.\n\n" +
  "If you already have one, tap it and it will connect you to the right business automatically.";

// ─── GET — Meta webhook verification handshake ────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  let config: { verifyToken: string };
  try {
    config = { verifyToken: getPlatformWhatsApp().verifyToken };
  } catch {
    return new NextResponse("Platform WhatsApp not configured.", { status: 503 });
  }

  const challenge = verifyWhatsAppWebhook(searchParams, config.verifyToken);
  if (!challenge) return new NextResponse("Forbidden", { status: 403 });
  return new NextResponse(challenge, { status: 200 });
}

// ─── POST — Inbound message handler ──────────────────────────────────────────

export async function POST(request: NextRequest) {
  // Rate limit: 60 requests per minute per IP
  const key = getRequestKey(request, "wa-platform-webhook");
  const { allowed } = rateLimit(key, 60, 60_000);
  if (!allowed) return new NextResponse("Too Many Requests", { status: 429 });

  const rawBody = await request.text();
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new NextResponse("Bad Request", { status: 400 });
  }

  // Validate HMAC signature using platform app secret
  const signatureHeader = request.headers.get("x-hub-signature-256");
  const valid = validatePlatformWhatsAppSignature(rawBody, signatureHeader);
  if (!valid) return new NextResponse("Unauthorized", { status: 401 });

  // Parse the incoming text message
  const incoming = parseWhatsAppMessage(payload);
  if (!incoming) {
    // Status update, delivery receipt, or non-text message — acknowledge silently
    return NextResponse.json({ status: "ok" });
  }

  const supabase = createSupabaseAdminClient();

  // ── Idempotency: skip already-processed messages ───────────────────────────
  const { data: existingMsg } = await supabase
    .from("chat_messages")
    .select("id")
    .eq("external_message_id", incoming.messageId)
    .maybeSingle();

  if (existingMsg) return NextResponse.json({ status: "ok" });

  // ── Business routing ───────────────────────────────────────────────────────
  //
  // Priority 1: Existing conversation — customer is mid-flow with a known business.
  // Priority 2: "START {slug}" — customer is starting fresh from the booking link.
  // Priority 3: Unknown — reply with help message.

  let businessId: string | null = null;
  let businessSlug: string | null = null;
  let existingConversationId: string | null = null;
  let existingState: ConversationState | null = null;
  let existingClientName: string | null = null;

  // Check for an active conversation for this phone number
  const { data: existingConv } = await supabase
    .from("chat_conversations")
    .select("id, business_id, state, client_name, businesses(slug)")
    .eq("platform", "whatsapp")
    .eq("external_chat_id", incoming.from)
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingConv) {
    businessId = existingConv.business_id as string;
    businessSlug = (existingConv.businesses as unknown as { slug: string } | null)?.slug ?? null;
    existingConversationId = existingConv.id as string;
    existingState = (existingConv.state ?? { step: "idle" }) as ConversationState;
    existingClientName = existingConv.client_name as string | null;
  }

  // If no existing conversation, try "START {slug}" routing
  if (!businessId) {
    const match = START_REGEX.exec(incoming.text);
    const slug = match?.[1]?.toLowerCase();

    if (slug) {
      const { data: business } = await supabase
        .from("businesses")
        .select("id, slug")
        .eq("slug", slug)
        .eq("whatsapp_enabled", true)
        .maybeSingle();

      if (business) {
        businessId = business.id as string;
        businessSlug = business.slug as string;
      }
    }
  }

  // Still no business — send the help message and exit
  if (!businessId || !businessSlug) {
    try {
      await sendPlatformWhatsAppMessage(incoming.from, UNKNOWN_BUSINESS_REPLY);
    } catch (e) {
      console.error("[WA Platform] Failed to send help message:", e);
    }
    return NextResponse.json({ status: "ok" });
  }

  // ── Upsert conversation record ─────────────────────────────────────────────
  const { data: conversation, error: convError } = await supabase
    .from("chat_conversations")
    .upsert(
      {
        business_id: businessId,
        platform: "whatsapp",
        external_chat_id: incoming.from,
        last_message_at: new Date().toISOString()
      },
      { onConflict: "business_id,platform,external_chat_id" }
    )
    .select("id, state, client_name")
    .single();

  if (convError || !conversation) return NextResponse.json({ status: "ok" });

  // ── Store incoming customer message ────────────────────────────────────────
  await supabase.from("chat_messages").insert({
    conversation_id: conversation.id,
    business_id: businessId,
    sender: "customer",
    body: incoming.text,
    external_message_id: incoming.messageId
  });

  // ── Run state machine ──────────────────────────────────────────────────────
  const state = (existingConversationId
    ? existingState
    : (conversation.state ?? { step: "idle" })) as ConversationState;

  const customerName = existingClientName ?? (conversation.client_name as string | null) ?? "";

  const { reply, newState } = await processMessage(
    supabase,
    businessId,
    businessSlug,
    incoming.from,
    customerName,
    state,
    incoming.text
  );

  // ── Persist updated conversation state ────────────────────────────────────
  await supabase
    .from("chat_conversations")
    .update({
      state: newState,
      client_name: newState.client_name ?? conversation.client_name,
      last_message_at: new Date().toISOString()
    })
    .eq("id", conversation.id);

  // ── Store system reply ────────────────────────────────────────────────────
  await supabase.from("chat_messages").insert({
    conversation_id: conversation.id,
    business_id: businessId,
    sender: "system",
    body: reply
  });

  // ── Send reply via platform number ────────────────────────────────────────
  try {
    await sendPlatformWhatsAppMessage(incoming.from, reply);
  } catch (e) {
    console.error("[WA Platform] Failed to send message:", e);
  }

  return NextResponse.json({ status: "ok" });
}
