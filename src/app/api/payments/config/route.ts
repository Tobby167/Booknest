import { ok } from "@/lib/api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const hasSupabaseAdminKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const hasStripeKeys = Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);

  if (!hasSupabaseAdminKey) {
    return ok({
      stripeEnabled: false,
      reason: "Supabase service role key is not configured yet."
    });
  }

  if (!hasStripeKeys) {
    return ok({
      stripeEnabled: false,
      reason: "Stripe keys are not configured yet."
    });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from("payments")
      .select("provider_checkout_session_id")
      .limit(1);

    if (error) {
      return ok({
        stripeEnabled: false,
        reason: "Stripe payment columns are not installed yet."
      });
    }
  } catch {
    return ok({
      stripeEnabled: false,
      reason: "Payment admin access is not configured yet."
    });
  }

  return ok({
    stripeEnabled: true,
    reason: null
  });
}
