import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { plan, isAnnual, currency } = await req.json();

    if (!plan || !["starter", "growth", "pro", "business"].includes(plan)) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    // Since this is the MVP, we are doing a MOCK checkout that instantly upgrades them
    // In production, this would generate a Stripe/Paystack Checkout URL and return it
    
    // Instead of charging, we'll just update their plan immediately
    const adminClient = createSupabaseAdminClient();
    const { error } = await adminClient
      .from("businesses")
      .update({
        plan: plan,
        subscription_status: "active"
      })
      .eq("owner_id", user.id);

    if (error) {
      console.error("Upgrade error:", error);
      return NextResponse.json({ error: "Database error during upgrade" }, { status: 500 });
    }

    // Return a dummy success URL to indicate success to the client
    return NextResponse.json({ url: "mock-success" });
  } catch (err) {
    console.error("Billing Checkout Error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
