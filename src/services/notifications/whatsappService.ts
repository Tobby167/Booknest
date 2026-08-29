import { createHmac } from "crypto";
import { decrypt } from "@/lib/encryption";
import { getPlatformWhatsApp } from "@/lib/env";

export type WhatsAppIntegrationRow = {
  id: string;
  business_id: string;
  phone_number_id: string;
  access_token_enc: string;
  app_secret_enc: string;
  verify_token: string;
  display_phone: string | null;
};

const WA_BASE = "https://graph.facebook.com/v21.0";

/**
 * Send a plain-text WhatsApp message via the Business Cloud API.
 * Used for per-business integrations (legacy) and by the platform sender below.
 */
export async function sendWhatsAppMessage(
  integration: WhatsAppIntegrationRow,
  to: string,
  text: string
): Promise<void> {
  const token = decrypt(integration.access_token_enc);
  const url = `${WA_BASE}/${integration.phone_number_id}/messages`;

  const body = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "text",
    text: { preview_url: false, body: text }
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`WhatsApp API error ${res.status}: ${detail}`);
  }
}

/**
 * Send a plain-text WhatsApp message using the BookNest platform shared number.
 * Reads credentials from PLATFORM_WA_* env vars — no DB lookup needed.
 */
export async function sendPlatformWhatsAppMessage(
  to: string,
  text: string
): Promise<void> {
  const { phoneNumberId, accessToken } = getPlatformWhatsApp();
  const url = `${WA_BASE}/${phoneNumberId}/messages`;

  const body = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "text",
    text: { preview_url: false, body: text }
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`WhatsApp platform API error ${res.status}: ${detail}`);
  }
}

/**
 * Validate the X-Hub-Signature-256 header using the platform app secret (from env).
 * Used by the shared webhook to verify all inbound messages are genuinely from Meta.
 */
export function validatePlatformWhatsAppSignature(
  rawBody: string,
  signatureHeader: string | null
): boolean {
  if (!signatureHeader) return false;
  try {
    const { appSecret } = getPlatformWhatsApp();
    const expected = `sha256=${createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;
    return expected === signatureHeader;
  } catch {
    return false;
  }
}

/**
 * Verify the Meta webhook GET handshake.
 * Returns the hub.challenge string on success, or null on failure.
 */
export function verifyWhatsAppWebhook(
  searchParams: URLSearchParams,
  verifyToken: string
): string | null {
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");
  if (mode === "subscribe" && token === verifyToken) return challenge;
  return null;
}

/**
 * Validate the X-Hub-Signature-256 header on an incoming WhatsApp POST.
 * Used for per-business integrations (legacy path).
 */
export function validateWhatsAppSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecretEnc: string
): boolean {
  if (!signatureHeader) return false;
  try {
    const appSecret = decrypt(appSecretEnc);
    const expected = `sha256=${createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;
    return expected === signatureHeader;
  } catch {
    return false;
  }
}

/**
 * Extract the first inbound text message from a WhatsApp webhook payload.
 */
export function parseWhatsAppMessage(payload: Record<string, unknown>): {
  from: string;
  text: string;
  messageId: string;
} | null {
  try {
    const entry = (payload.entry as unknown[])?.[0] as Record<string, unknown>;
    const change = (entry?.changes as unknown[])?.[0] as Record<string, unknown>;
    const value = change?.value as Record<string, unknown>;
    const messages = value?.messages as Record<string, unknown>[];
    const msg = messages?.[0];
    if (!msg || msg.type !== "text") return null;
    const text = (msg.text as Record<string, unknown>)?.body as string;
    if (!text) return null;
    return { from: msg.from as string, text: text.trim(), messageId: msg.id as string };
  } catch {
    return null;
  }
}
