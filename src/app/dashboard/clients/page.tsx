import { ClientsPanel } from "@/components/dashboard/ClientsPanel";
import { getOwnedBusiness } from "@/lib/api";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Lock } from "lucide-react";
import Link from "next/link";

export default async function ClientsPage() {
  const supabase = await createSupabaseServerClient();
  const business = await getOwnedBusiness(supabase);
  
  const isLocked = !business?.is_lifetime && (business?.plan === "starter" || business?.plan === "growth");

  if (isLocked) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center text-center">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm max-w-md w-full">
          <Lock className="mx-auto mb-4 h-12 w-12 text-slate-300" />
          <h2 className="mb-2 text-xl font-black text-slate-900">Client Management is Locked</h2>
          <p className="mb-6 text-sm text-slate-500">
            Upgrade to the Pro or Business plan to manage your clients, track their history, and assign VIP statuses.
          </p>
          <Link href="/dashboard/billing" className="inline-block rounded-lg bg-purple-600 px-6 py-3 text-sm font-bold text-white hover:bg-purple-500 transition">
            Upgrade Plan
          </Link>
        </div>
      </div>
    );
  }

  return <ClientsPanel />;
}
