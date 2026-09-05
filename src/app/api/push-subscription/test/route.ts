import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendWebPush, type PushSubscriptionRow } from "@/services/notifications/webPushSender";

export async function POST() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized. Please log in to send a test alert." }, { status: 401 });
    }

    const admin = createSupabaseAdminClient();
    const { data: subs, error } = await admin
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ 
        error: `Database error: ${error.message}. Make sure you ran supabase-push-subscriptions.sql in Supabase.` 
      }, { status: 500 });
    }

    if (!subs || subs.length === 0) {
      return NextResponse.json({ 
        error: "No active push subscriptions found. Please click 'Enable Notifications' on this device first." 
      }, { status: 404 });
    }

    let sentCount = 0;
    const expired: string[] = [];

    await Promise.all(
      subs.map(async (sub: PushSubscriptionRow) => {
        const result = await sendWebPush(sub, {
          title: "🎉 BookNest Test Notification",
          body: "Push alerts are working perfectly on this device!",
          url: "/dashboard"
        });
        if (result === true) sentCount++;
        if (result === "gone") expired.push(sub.endpoint);
      })
    );

    if (expired.length > 0) {
      await admin.from("push_subscriptions").delete().in("endpoint", expired);
    }

    if (sentCount === 0) {
      return NextResponse.json({ 
        error: "Failed to dispatch push notification. Check that VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY are properly configured in Vercel." 
      }, { status: 500 });
    }

    return NextResponse.json({ ok: true, sentCount, totalSubs: subs.length });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
