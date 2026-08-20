import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { BillingPanel } from "@/components/dashboard/BillingPanel";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: business } = await supabase
    .from("businesses")
    .select("id, plan, trial_ends_at, subscription_status, is_lifetime")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!business) redirect("/dashboard/setup");

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h1 className="text-2xl font-black text-ink sm:text-3xl">Billing & Plans</h1>
        <p className="mt-2 text-sm leading-6 text-ink/60">
          Manage your BookNest subscription and unlock premium features to grow your business.
        </p>
      </div>

      <BillingPanel 
        businessId={business.id}
        currentPlan={business.plan || "starter"}
        status={business.subscription_status}
        trialEndsAt={business.trial_ends_at}
        isLifetime={!!business.is_lifetime}
      />
    </div>
  );
}
