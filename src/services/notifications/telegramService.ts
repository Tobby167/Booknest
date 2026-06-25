import { createHmac } from "crypto";
import { decrypt } from "@/lib/encryption";
import { getSiteUrl } from "@/lib/env";

export type TelegramIntegrationRow = {
  id: string;
  business_id: string;
  bot_username: string;
  bot_token_enc: string;
  webhook_secret: string;
};

const TG_BASE = "https://api.telegram.org";

function apiUrl(tokenEnc: string, method: string): string {
  const token = decrypt(tokenEnc);
  return `${TG_BASE}/bot${token}/${method}`;
}

/**
 * Send a plain-text Telegram message.
 */
export async function sendTelegramMessage(
  integration: TelegramIntegrationRow,
  chatId: string,
  text: string
): Promise<void> {
  const res = await fetch(apiUrl(integration.bot_token_enc, "sendMessage"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" })
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Telegram API error ${res.status}: ${detail}`);
  }
}

/**
 * Register our Next.js route as the Telegram bot webhook.
 * Called once when the business connects their bot.
 */
export async function setupTelegramWebhook(
  integration: TelegramIntegrationRow
): Promise<void> {
  const webhookUrl = `${getSiteUrl()}/api/webhooks/telegram`;
  const res = await fetch(apiUrl(integration.bot_token_enc, "setWebhook"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: webhookUrl,
      secret_token: integration.webhook_secret,
      allowed_updates: ["message"]
    })
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Telegram setWebhook error ${res.status}: ${detail}`);
  }
}

/**
 * Delete the Telegram webhook (used on disconnect).
 */
export async function deleteTelegramWebhook(
  integration: TelegramIntegrationRow
): Promise<void> {
  await fetch(apiUrl(integration.bot_token_enc, "deleteWebhook"), { method: "POST" });
}

/**
 * Validate the X-Telegram-Bot-Api-Secret-Token header.
 */
export function validateTelegramSecret(
  secretHeader: string | null,
  expectedSecret: string
): boolean {
  if (!secretHeader) return false;
  // Constant-time comparison
  const a = Buffer.from(secretHeader);
  const b = Buffer.from(expectedSecret);
  if (a.length !== b.length) return false;
  return createHmac("sha256", "compare").update(a).digest().equals(createHmac("sha256", "compare").update(b).digest());
}

/**
 * Fetch bot info to test the token is valid.
 */
export async function getTelegramBotInfo(botTokenEnc: string): Promise<{ username: string; first_name: string }> {
  const res = await fetch(apiUrl(botTokenEnc, "getMe"));
  if (!res.ok) throw new Error("Invalid Telegram bot token.");
  const json = (await res.json()) as { ok: boolean; result: { username: string; first_name: string } };
  if (!json.ok) throw new Error("Telegram getMe returned not ok.");
  return json.result;
}

/**
 * Extract inbound message from a Telegram webhook payload.
 */
export function parseTelegramMessage(payload: Record<string, unknown>): {
  chatId: string;
  text: string;
  messageId: number;
  fromName: string;
} | null {
  try {
    const message = payload.message as Record<string, unknown>;
    if (!message) return null;
    let text = (message.text as string)?.trim();
    if (!text) return null;

    // Strip @BotName suffix from slash commands.
    // Telegram sends "/book@MyBotName" when the command is tapped in a group
    // or from the command list. We normalise it to just "/book".
    if (text.startsWith("/")) {
      text = text.replace(/@\S+/, "").trim();
    }

    const chat = message.chat as Record<string, unknown>;
    const from = message.from as Record<string, unknown>;
    const firstName = (from?.first_name as string) ?? "";
    const lastName = (from?.last_name as string) ?? "";
    return {
      chatId: String(chat.id),
      text,
      messageId: message.message_id as number,
      fromName: [firstName, lastName].filter(Boolean).join(" ")
    };
  } catch {
    return null;
  }
}
