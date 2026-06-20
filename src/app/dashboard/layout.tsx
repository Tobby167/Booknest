import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { DashboardNav } from "@/components/dashboard/DashboardNav";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

  return (
    <main className="min-h-screen overflow-x-hidden bg-slate-50 lg:flex">
      <DashboardNav />
      <section className="min-w-0 flex-1 px-3 pb-4 pt-16 sm:px-5 lg:ml-52 lg:px-8 lg:py-4">{children}</section>
    </main>
  );
}
