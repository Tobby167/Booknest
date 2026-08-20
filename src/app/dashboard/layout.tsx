import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { DashboardNav } from "@/components/dashboard/DashboardNav";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { BookNestCopilot } from "@/components/dashboard/BookNestCopilot";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }
  const userId = user.id;

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (profile?.role === "client") redirect("/client/bookings");
  if (profile?.role && !["business_owner", "admin", "staff"].includes(profile.role)) redirect("/login");

  const [{ data: business }, { data: activeBroadcast }] = await Promise.all([
    supabase.from("businesses").select("plan, is_lifetime").eq("owner_id", userId).maybeSingle(),
    supabase.from("admin_broadcasts").select("*").eq("is_active", true).order("created_at", { ascending: false }).limit(1).maybeSingle()
  ]);

  return (
    <main className="min-h-screen overflow-x-hidden bg-slate-50 lg:flex">
      <DashboardNav plan={business?.plan || "starter"} isLifetime={!!business?.is_lifetime} />
      <section className="min-w-0 flex-1 px-3 pb-4 pt-16 sm:px-5 lg:ml-52 lg:px-8 lg:py-4">
        {activeBroadcast && (
          <div className={`mb-6 rounded-xl border p-4 shadow-sm ${
            activeBroadcast.tone === 'blue' ? 'bg-blue-50 border-blue-200 text-blue-800' :
            activeBroadcast.tone === 'emerald' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
            activeBroadcast.tone === 'amber' ? 'bg-amber-50 border-amber-200 text-amber-800' :
            'bg-red-50 border-red-200 text-red-800'
          }`}>
            <h4 className="font-black flex items-center gap-2">
              <span className="text-lg">📢</span> {activeBroadcast.title}
            </h4>
            <p className="mt-1 text-sm font-bold opacity-80">{activeBroadcast.message}</p>
          </div>
        )}
        {children}
      </section>
      <BookNestCopilot />
    </main>
  );
}
