import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  // To secure this endpoint, you would typically check for a cron secret header
  // e.g. req.headers.get("Authorization") === `Bearer ${process.env.CRON_SECRET}`
  
  try {
    const supabase = createSupabaseAdminClient();
    
    // Find businesses whose trial has expired
    const { data: expiredBusinesses, error: fetchError } = await supabase
      .from("businesses")
      .select("id, name")
      .eq("subscription_status", "trialing")
      .not("trial_ends_at", "is", null)
      .lt("trial_ends_at", new Date().toISOString());

    if (fetchError) {
      console.error("Cron fetch error:", fetchError);
      return NextResponse.json({ error: "Failed to fetch expired trials" }, { status: 500 });
    }

    if (!expiredBusinesses || expiredBusinesses.length === 0) {
      return NextResponse.json({ message: "No expired trials found." });
    }

    // Downgrade them to Starter
    const idsToDowngrade = expiredBusinesses.map(b => b.id);
    const { error: updateError } = await supabase
      .from("businesses")
      .update({
        plan: "starter",
        subscription_status: null // Reset status since they are now on the free tier
      })
      .in("id", idsToDowngrade);

    if (updateError) {
      console.error("Cron update error:", updateError);
      return NextResponse.json({ error: "Failed to downgrade businesses" }, { status: 500 });
    }

    // Note: If we had a graceful payment failure webhook from Stripe,
    // we would handle the "7-day grace period" check here as well by checking
    // if subscription_status = 'past_due' and 7 days have passed since the invoice failed.

    return NextResponse.json({ 
      message: `Successfully downgraded ${idsToDowngrade.length} expired trials to Starter plan.`,
      businesses: expiredBusinesses.map(b => b.name)
    });

  } catch (err) {
    console.error("Cron error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
