import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// GET — return the VAPID public key so the browser can subscribe
export async function GET() {
  const key = (process.env.VAPID_PUBLIC_KEY || "").trim().replace(/^['"]|['"]$/g, "");
  if (!key) {
    console.error("[Push] VAPID_PUBLIC_KEY is not set in environment variables");
    return NextResponse.json({ error: "VAPID not configured on server. Check VAPID_PUBLIC_KEY in Vercel." }, { status: 500 });
  }
  console.log("[Push] GET /api/push-subscription — returning public key (starts with):", key.slice(0, 8));
  return NextResponse.json({ publicKey: key });
}

// POST — save a push subscription for the current logged-in user
export async function POST(req: NextRequest) {
  try {
    console.log("[Push] POST /api/push-subscription — saving subscription");

    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError) {
      console.error("[Push] Auth error:", authError.message);
      return NextResponse.json(
        { error: `Auth error: ${authError.message}. Try logging out and back in.` },
        { status: 401 }
      );
    }

    if (!user) {
      console.error("[Push] No user session found. Cookies may not be sent from this browser/device.");
      return NextResponse.json(
        { error: "Not logged in. Your browser may be blocking session cookies. Try logging out and back in, then re-enable notifications." },
        { status: 401 }
      );
    }

    console.log("[Push] Authenticated as user:", user.id);

    const body = await req.json();
    const { endpoint, keys } = body;

    console.log("[Push] Subscription endpoint (start):", endpoint?.slice(0, 60));

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      console.error("[Push] Invalid subscription body:", JSON.stringify({ endpoint: !!endpoint, p256dh: !!keys?.p256dh, auth: !!keys?.auth }));
      return NextResponse.json({ error: "Invalid subscription data received from browser" }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();

    // Get the business owned by this user
    const { data: business, error: bizError } = await admin
      .from("businesses")
      .select("id")
      .eq("owner_id", user.id)
      .maybeSingle();

    if (bizError) {
      console.warn("[Push] Business lookup error (non-fatal):", bizError.message);
    }

    console.log("[Push] Business found:", business?.id ?? "none");

    // Upsert the subscription (keyed by endpoint to avoid duplicates)
    const { error: upsertError } = await admin.from("push_subscriptions").upsert(
      {
        user_id: user.id,
        business_id: business?.id ?? null,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
      { onConflict: "endpoint" }
    );

    if (upsertError) {
      console.error("[Push] Upsert error:", upsertError.message);
      return NextResponse.json(
        { error: `Database error: ${upsertError.message}. Make sure you ran supabase-push-subscriptions.sql in Supabase SQL Editor.` },
        { status: 500 }
      );
    }

    console.log("[Push] Subscription saved successfully for user:", user.id);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[Push] Unexpected error in POST:", err?.message);
    return NextResponse.json({ error: err?.message || "Internal error" }, { status: 500 });
  }
}

// DELETE — remove a push subscription
export async function DELETE(req: NextRequest) {
  try {
    const { endpoint } = await req.json();
    if (!endpoint) return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });

    const admin = createSupabaseAdminClient();
    await admin.from("push_subscriptions").delete().eq("endpoint", endpoint);

    console.log("[Push] Subscription deleted:", endpoint?.slice(0, 60));
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
