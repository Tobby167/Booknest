export function getSiteUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configuredUrl) return configuredUrl.replace(/\/$/, "");

  return "https://booknest-ashy.vercel.app";
}

export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }

  return { url, anonKey };
}

/**
 * Returns the platform-level WhatsApp Cloud API credentials.
 * These are set once by the BookNest developer in .env — businesses never touch them.
 * Throws if any required variable is missing.
 */
export function getPlatformWhatsApp(): {
  phoneNumberId: string;
  accessToken: string;
  appSecret: string;
  verifyToken: string;
} {
  const phoneNumberId = process.env.PLATFORM_WA_PHONE_NUMBER_ID;
  const accessToken = process.env.PLATFORM_WA_ACCESS_TOKEN;
  const appSecret = process.env.PLATFORM_WA_APP_SECRET;
  const verifyToken = process.env.PLATFORM_WA_VERIFY_TOKEN;

  if (!phoneNumberId || !accessToken || !appSecret || !verifyToken) {
    throw new Error(
      "Platform WhatsApp is not configured. Set PLATFORM_WA_PHONE_NUMBER_ID, " +
      "PLATFORM_WA_ACCESS_TOKEN, PLATFORM_WA_APP_SECRET, and PLATFORM_WA_VERIFY_TOKEN."
    );
  }

  return { phoneNumberId, accessToken, appSecret, verifyToken };
}

