import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { ok, fail, requireUser, requireOwnedBusiness } from "@/lib/api";
import { encrypt } from "@/lib/encryption";
import { getSiteUrl, getPlatformWhatsApp } from "@/lib/env";
import { setupTelegramWebhook, deleteTelegramWebhook, type TelegramIntegrationRow } from "@/services/notifications/telegramService";

// ─── helpers ──────────────────────────────────────────────────────────────────

/**
 * Build the customer-facing wa.me booking link for a business.
 * The pre-filled message "START {slug}" is what routes the conversation
 * to the correct business on the shared BookNest WhatsApp number.
 */
function buildWaLink(slug: string, phoneNumberId: string): string {
  // We store the phone number ID not the E.164 number in env, so we expose
  // a display number via PLATFORM_WA_DISPLAY_PHONE env var (optional).
  // If not set, we fall back to a link that just pre-fills the message.
  const displayPhone = process.env.PLATFORM_WA_DISPLAY_PHONE ?? "";
  const text = encodeURIComponent(`START ${slug}`);
  return displayPhone
    ? `https://wa.me/${displayPhone.replace(/\D/g, "")}?text=${text}`
    : `https://wa.me/?text=${text}`;
}

function buildQrUrl(link: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(link)}`;
}

// ─── GET /api/dashboard/integrations ──────────────────────────────────────────
// Returns current WhatsApp (toggle status + booking link) and Telegram statuses.

export async function GET() {
  const { supabase, response } = await requireUser();
  if (response) return response;
  const { business, response: bizResp } = await requireOwnedBusiness(supabase);
  if (bizResp) return bizResp;

  const biz = business!;

  // WhatsApp — platform shared number (just a flag + generated link)
  let platformWaAvailable = true;
  let waLink: string | null = null;
  let waQrUrl: string | null = null;

  try {
    const { phoneNumberId } = getPlatformWhatsApp();
    if (biz.whatsapp_enabled) {
      waLink = buildWaLink(biz.slug, phoneNumberId);
      waQrUrl = buildQrUrl(waLink);
    }
  } catch {
    // Platform WA env vars not set — feature unavailable
    platformWaAvailable = false;
  }

  // Telegram — per-business bot
  const { data: tg } = await supabase
    .from("telegram_integrations")
    .select("id, bot_username, is_active, created_at")
    .eq("business_id", biz.id)
    .maybeSingle();

  return ok({
    whatsapp: {
      platform_available: platformWaAvailable,
      enabled: biz.whatsapp_enabled ?? false,
      link: waLink,
      qr_url: waQrUrl,
      display_phone: process.env.PLATFORM_WA_DISPLAY_PHONE ?? null
    },
    telegram: tg ?? null
  });
}

// ─── POST /api/dashboard/integrations ─────────────────────────────────────────
// Toggle WhatsApp on/off, or connect Telegram.

export async function POST(request: NextRequest) {
  const { supabase, response } = await requireUser();
  if (response) return response;
  const { business, response: bizResp } = await requireOwnedBusiness(supabase);
  if (bizResp) return bizResp;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid request body.", 400);
  }

  const { platform } = body;

  // ── WhatsApp — just toggle the flag ───────────────────────────────────────
  if (platform === "whatsapp") {
    const enabled = body.enabled === true;

    // Check the platform credentials are actually configured
    try {
      getPlatformWhatsApp();
    } catch {
      return fail("The BookNest WhatsApp integration is not yet configured on this server.", 503);
    }

    const { error } = await supabase
      .from("businesses")
      .update({ whatsapp_enabled: enabled })
      .eq("id", business!.id);

    if (error) return fail("Failed to update WhatsApp status.", 500);

    let waLink: string | null = null;
    let waQrUrl: string | null = null;
    if (enabled) {
      const { phoneNumberId } = getPlatformWhatsApp();
      waLink = buildWaLink(business!.slug, phoneNumberId);
      waQrUrl = buildQrUrl(waLink);
    }

    return ok({ success: true, platform: "whatsapp", enabled, link: waLink, qr_url: waQrUrl });
  }

  // ── Telegram — paste bot token, auto-register webhook ────────────────────
  if (platform === "telegram") {
    const { bot_token } = body as Record<string, string>;
    if (!bot_token) return fail("bot_token is required.", 400);

    const bot_token_enc = encrypt(bot_token);
    const webhook_secret = randomBytes(32).toString("hex");

    // Validate token by fetching bot info from Telegram
    const infoRes = await fetch(`https://api.telegram.org/bot${bot_token}/getMe`);
    if (!infoRes.ok) return fail("Invalid Telegram bot token. Could not reach Telegram API.", 400);
    const infoJson = (await infoRes.json()) as { ok: boolean; result?: { username: string } };
    if (!infoJson.ok || !infoJson.result?.username) return fail("Telegram token did not return a valid bot.", 400);

    const bot_username = infoJson.result.username;

    const { error } = await supabase.from("telegram_integrations").upsert(
      {
        business_id: business!.id,
        bot_username,
        bot_token_enc,
        webhook_secret,
        is_active: true,
        updated_at: new Date().toISOString()
      },
      { onConflict: "business_id" }
    );

    if (error) return fail("Failed to save Telegram integration.", 500);

    const integration: TelegramIntegrationRow = {
      id: "",
      business_id: business!.id,
      bot_username,
      bot_token_enc,
      webhook_secret
    };

    try {
      await setupTelegramWebhook(integration);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      return fail(`Integration saved but webhook setup failed: ${msg}`, 500);
    }

    return ok({ success: true, platform: "telegram", bot_username });
  }

  return fail("Unknown platform. Use 'whatsapp' or 'telegram'.", 400);
}

// ─── DELETE /api/dashboard/integrations ───────────────────────────────────────
// Disable WhatsApp, or disconnect Telegram.

export async function DELETE(request: NextRequest) {
  const { supabase, response } = await requireUser();
  if (response) return response;
  const { business, response: bizResp } = await requireOwnedBusiness(supabase);
  if (bizResp) return bizResp;

  let body: { platform: string };
  try {
    body = await request.json();
  } catch {
    return fail("Invalid request body.", 400);
  }

  if (body.platform === "whatsapp") {
    const { error } = await supabase
      .from("businesses")
      .update({ whatsapp_enabled: false })
      .eq("id", business!.id);

    if (error) return fail("Failed to disable WhatsApp.", 500);
    return ok({ success: true });
  }

  if (body.platform === "telegram") {
    const { data: integration } = await supabase
      .from("telegram_integrations")
      .select("*")
      .eq("business_id", business!.id)
      .maybeSingle();

    if (integration) {
      try {
        await deleteTelegramWebhook(integration as TelegramIntegrationRow);
      } catch { /* ignore errors on webhook delete */ }
    }

    await supabase.from("telegram_integrations").delete().eq("business_id", business!.id);
    return ok({ success: true });
  }

  return fail("Unknown platform.", 400);
}
