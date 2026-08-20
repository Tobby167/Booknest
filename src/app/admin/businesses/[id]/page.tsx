import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Building2, Mail, Phone, Calendar, CreditCard, DollarSign } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { currency, dateLabel } from "@/lib/format";
import { BusinessActions } from "@/components/admin/BusinessActions";

export default async function AdminBusinessPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createSupabaseServerClient();
  const { id } = await params;

  const [
    { data: business },
    { data: appointments },
    { data: payments },
    { data: services }
  ] = await Promise.all([
    supabase.from("businesses").select("*").eq("id", id).maybeSingle(),
    supabase.from("appointments").select("*").eq("business_id", id).order("appointment_date", { ascending: false }),
    supabase.from("payments").select("*").eq("business_id", id).order("created_at", { ascending: false }),
    supabase.from("services").select("id").eq("business_id", id)
  ]);

  if (!business) return notFound();

  // Fetch owner profile
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", business.owner_id).maybeSingle();

  const confirmedRevenue = (payments ?? [])
    .filter((p) => p.status === "confirmed")
    .reduce((total, p) => total + Number(p.amount || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/businesses" className="rounded-full bg-slate-200 p-2 text-ink/60 hover:bg-slate-300 transition">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-black text-ink sm:text-3xl">{business.name}</h1>
          <p className="mt-1 text-sm text-ink/60">Business ID: {business.id}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column: Details & Stats */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-bold text-ink/55">Total Revenue</p>
              <p className="mt-1 flex items-center gap-2 text-2xl font-black text-ink">
                <DollarSign className="h-5 w-5 text-emerald-500" />
                {currency(confirmedRevenue)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-bold text-ink/55">Appointments</p>
              <p className="mt-1 flex items-center gap-2 text-2xl font-black text-ink">
                <Calendar className="h-5 w-5 text-purple-500" />
                {(appointments ?? []).length}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-bold text-ink/55">Services</p>
              <p className="mt-1 flex items-center gap-2 text-2xl font-black text-ink">
                <Building2 className="h-5 w-5 text-blue-500" />
                {(services ?? []).length}
              </p>
            </div>
          </div>

          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-black text-ink">Contact & Setup</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
                <Mail className="h-5 w-5 text-ink/40" />
                <div>
                  <p className="text-xs font-bold text-ink/55">Email</p>
                  <p className="text-sm font-bold text-ink">{business.email || profile?.email || "Missing"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
                <Phone className="h-5 w-5 text-ink/40" />
                <div>
                  <p className="text-xs font-bold text-ink/55">Phone</p>
                  <p className="text-sm font-bold text-ink">{business.phone || "Missing"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
                <CreditCard className="h-5 w-5 text-ink/40" />
                <div>
                  <p className="text-xs font-bold text-ink/55">Bank Name</p>
                  <p className="text-sm font-bold text-ink">{business.bank_name || "Missing"}</p>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="font-black text-ink">Recent Appointments</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-left text-sm">
                <thead className="bg-slate-50 text-xs font-black text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3">Client</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(appointments ?? []).slice(0, 5).map((apt) => (
                    <tr key={apt.id}>
                      <td className="px-5 py-4 font-bold text-ink">{dateLabel(apt.appointment_date)}</td>
                      <td className="px-5 py-4 text-ink/70">{apt.client_name}</td>
                      <td className="px-5 py-4">
                        <span className={`rounded-full px-3 py-1 text-xs font-black ${apt.status === "confirmed" ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-600"}`}>
                          {apt.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 font-bold text-ink">{currency(apt.total_price)}</td>
                    </tr>
                  ))}
                  {!(appointments ?? []).length && (
                    <tr>
                      <td colSpan={4} className="px-5 py-4 text-center text-ink/55">No appointments yet</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* Right Column: Actions */}
        <div>
          <BusinessActions 
            businessId={business.id} 
            ownerEmail={profile?.email || ""} 
            currentPlan={business.plan}
            isBanned={business.is_banned ?? false}
          />
        </div>
      </div>
    </div>
  );
}
