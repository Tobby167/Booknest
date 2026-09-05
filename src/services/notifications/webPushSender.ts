import webpush from "web-push";

function getVapidDetails() {
  const publicKey = (process.env.VAPID_PUBLIC_KEY || "").trim().replace(/^['"]|['"]$/g, "");
  const privateKey = (process.env.VAPID_PRIVATE_KEY || "").trim().replace(/^['"]|['"]$/g, "");
  const subject = (process.env.VAPID_SUBJECT || "mailto:admin@booknest.app").trim().replace(/^['"]|['"]$/g, "");
  return { publicKey, privateKey, subject };
}

export interface PushSubscriptionRow {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export async function sendWebPush(
  subscription: PushSubscriptionRow,
  payload: { title: string; body: string; url?: string }
) {
  try {
    const { publicKey, privateKey, subject } = getVapidDetails();
    if (!publicKey || !privateKey) {
      console.warn("[WebPush] Missing VAPID keys. Skipping push notification.");
      return false;
    }
    webpush.setVapidDetails(subject, publicKey, privateKey);
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify({
        title: payload.title,
        body: payload.body,
        url: payload.url || "/dashboard/appointments",
        icon: "/pwa-icon.svg",
        badge: "/favicon.svg",
      })
    );
    return true;
  } catch (err: any) {
    // 410 Gone = subscription expired/revoked, caller should delete it
    if (err?.statusCode === 410) return "gone";
    console.error("[WebPush] sendNotification failed:", err?.message);
    return false;
  }
}
