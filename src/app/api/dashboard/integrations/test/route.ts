import { NextRequest } from "next/server";
import { ok, fail, requireUser, requireOwnedBusiness } from "@/lib/api";
import { getTelegramBotInfo } from "@/services/notifications/telegramService";
import { decrypt } from "@/lib/encryption";

// POST /api/dashboard/integrations/test
export async function POST(request: NextRequest) {
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

  // ── WhatsApp ──────────────────────────────────────────────────────────
  if (body.platform === "whatsapp") {
    const { data: integration } = await supabase
      .from("whatsapp_integrations")
      .select("*")
      .eq("business_id", business!.id)
      .maybeSingle();

    if (!integration) return fail("No WhatsApp integration found.", 404);

    try {
      const token = decrypt(integration.access_token_enc);
      const res = await fetch(
        `https://graph.facebook.com/v19.0/${integration.phone_number_id}?fields=display_phone_number,verified_name`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        return fail(`WhatsApp API returned error: ${detail}`, 400);
      }
      const data = (await res.json()) as { display_phone_number: string; verified_name: string };
      return ok({ success: true, platform: "whatsapp", phone: data.display_phone_number, name: data.verified_name });
    } catch (e) {
      return fail(e instanceof Error ? e.message : "Connection test failed.", 400);
    }
  }

  // ── Telegram ──────────────────────────────────────────────────────────
  if (body.platform === "telegram") {
    const { data: integration } = await supabase
      .from("telegram_integrations")
      .select("*")
      .eq("business_id", business!.id)
      .maybeSingle();

    if (!integration) return fail("No Telegram integration found.", 404);

    try {
      const info = await getTelegramBotInfo(integration.bot_token_enc);
      return ok({ success: true, platform: "telegram", username: info.username, name: info.first_name });
    } catch (e) {
      return fail(e instanceof Error ? e.message : "Connection test failed.", 400);
    }
  }

  return fail("Unknown platform.", 400);
}
