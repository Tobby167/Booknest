import Link from "next/link";
import { AlertTriangle, Bell, Building2, CreditCard, Mail, Users } from "lucide-react";
import { currency, dateLabel } from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAppointmentEmailStatus } from "@/services/notifications/emailProviderStatus";

type BusinessRow = {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  email: string | null;
  phone: string | null;
  logo_url: string | null;
  bank_name: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  created_at?: string;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  created_at: string;
};

type AppointmentRow = {
  id: string;
  business_id: string;
  status: string;
  payment_status: string;
  total_price: number | null;
  appointment_date: string;
};

type PaymentRow = {
  id: string;
  business_id: string;
  amount: number | null;
  status: string;
  receipt_image_url: string | null;
  created_at: string;
};

function setupIssues(
  business: BusinessRow,
  servicesByBusiness: Map<string, number>,
  availabilityByBusiness: Map<string, number>
) {
  const issues: string[] = [];
  if (!business.email && !business.phone) issues.push("missing contact");
  if (!business.logo_url) issues.push("missing logo");
  if (!servicesByBusiness.get(business.id)) issues.push("no services");
  if (!availabilityByBusiness.get(business.id)) issues.push("no open availability");
  if (!business.bank_name && !business.bank_account_name && !business.bank_account_number) issues.push("no manual payment details");
  return issues;
}

export default async function AdminPage() {
  const supabase = await createSupabaseServerClient();
  const emailStatus = getAppointmentEmailStatus();

  const [
    { data: businesses },
    { data: profiles },
    { data: appointments },
    { data: payments },
    { data: services },
    { data: availability },
    { data: notifications }
  ] = await Promise.all([
    supabase.from("businesses").select("*").order("created_at", { ascending: false }),
    supabase.from("profiles").select("*").order("created_at", { ascending: false }),
    supabase.from("appointments").select("*").order("appointment_date", { ascending: false }),
    supabase.from("payments").select("*").order("created_at", { ascending: false }),
    supabase.from("services").select("id,business_id"),
    supabase.from("availability").select("id,business_id,is_available").eq("is_available", true),
    supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(8)
  ]);

  const businessRows = (businesses ?? []) as BusinessRow[];
  const profileRows = (profiles ?? []) as ProfileRow[];
  const appointmentRows = (appointments ?? []) as AppointmentRow[];
  const paymentRows = (payments ?? []) as PaymentRow[];
  const servicesByBusiness = new Map<string, number>();
  const availabilityByBusiness = new Map<string, number>();

  (services ?? []).forEach((service) => servicesByBusiness.set(service.business_id, (servicesByBusiness.get(service.business_id) ?? 0) + 1));
  (availability ?? []).forEach((row) => availabilityByBusiness.set(row.business_id, (availabilityByBusiness.get(row.business_id) ?? 0) + 1));

  const issueRows = businessRows
    .map((business) => ({ business, issues: setupIssues(business, servicesByBusiness, availabilityByBusiness) }))
    .filter((row) => row.issues.length > 0);

  const confirmedRevenue = paymentRows
    .filter((payment) => payment.status === "confirmed")
    .reduce((total, payment) => total + Number(payment.amount || 0), 0);

  const statCards = [
    { label: "Businesses", value: businessRows.length, icon: Building2, tone: "bg-purple-50 text-purple-600" },
    { label: "Users", value: profileRows.length, icon: Users, tone: "bg-sky-50 text-sky-600" },
    { label: "Appointments", value: appointmentRows.length, icon: Bell, tone: "bg-emerald-50 text-emerald-600" },
    { label: "Confirmed revenue", value: currency(confirmedRevenue), icon: CreditCard, tone: "bg-green-50 text-green-600" }
  ];

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-purple-600">Super admin</p>
        <h1 className="mt-2 text-2xl font-black text-ink sm:text-3xl">BookNest Control Center</h1>
        <p className="mt-2 text-sm leading-6 text-ink/60">Monitor businesses, users, payments, setup issues, and optional provider readiness.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm" key={card.label}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-ink/55">{card.label}</p>
                  <p className="mt-2 text-2xl font-black text-ink">{card.value}</p>
                </div>
                <span className={`rounded-full p-2.5 ${card.tone}`}>
                  <Icon className="h-5 w-5" />
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <span className={`grid h-10 w-10 place-items-center rounded-xl ${emailStatus.configured ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}`}>
            <Mail className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-black text-ink">Appointment email provider</h2>
            <p className="mt-1 text-sm font-bold text-ink/60">{emailStatus.label}</p>
            <p className="mt-1 text-sm leading-6 text-ink/55">{emailStatus.reason}</p>
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-black text-ink">Setup issues</h2>
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-600">{issueRows.length} needs attention</span>
          </div>
          <div className="mt-4 space-y-3">
            {issueRows.slice(0, 8).map(({ business, issues }) => (
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4" key={business.id}>
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />
                  <div>
                    <p className="font-black text-ink">{business.name}</p>
                    <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-ink/45">{issues.join(" | ")}</p>
                  </div>
                </div>
              </div>
            ))}
            {!issueRows.length ? <p className="rounded-xl bg-emerald-50 p-4 text-sm font-bold text-emerald-700">All businesses look configured.</p> : null}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-black text-ink">Recent notifications</h2>
          </div>
          <div className="mt-4 space-y-3">
            {(notifications ?? []).map((notification) => (
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4" key={notification.id}>
                <p className="font-black text-ink">{notification.title || "Notification"}</p>
                <p className="mt-1 text-sm leading-6 text-ink/60">{notification.message || "No message"}</p>
              </div>
            ))}
            {!(notifications ?? []).length ? <p className="rounded-xl bg-slate-50 p-4 text-sm font-bold text-ink/55">No notifications yet.</p> : null}
          </div>
        </section>
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="font-black text-ink">Recent businesses</h2>
          <Link className="text-xs font-black text-purple-600" href="/admin/businesses">View all</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-black text-slate-500">
              <tr>
                <th className="px-5 py-3">Business</th>
                <th className="px-5 py-3">Owner</th>
                <th className="px-5 py-3">Services</th>
                <th className="px-5 py-3">Contact</th>
                <th className="px-5 py-3">Public page</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {businessRows.slice(0, 8).map((business) => {
                const owner = profileRows.find((profile) => profile.id === business.owner_id);
                return (
                  <tr key={business.id}>
                    <td className="px-5 py-4">
                      <p className="font-black text-ink">{business.name}</p>
                      <p className="text-xs text-ink/45">/{business.slug}</p>
                    </td>
                    <td className="px-5 py-4 text-ink/70">{owner?.email || owner?.full_name || "Unknown"}</td>
                    <td className="px-5 py-4 font-bold text-ink">{servicesByBusiness.get(business.id) ?? 0}</td>
                    <td className="px-5 py-4 text-ink/70">{business.email || business.phone || "Missing"}</td>
                    <td className="px-5 py-4">
                      <Link className="text-xs font-black text-purple-600" href={`/book/${business.slug}`}>Open</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="font-black text-ink">Recent payments</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-black text-slate-500">
              <tr>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Business</th>
                <th className="px-5 py-3">Amount</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paymentRows.slice(0, 8).map((payment) => {
                const business = businessRows.find((row) => row.id === payment.business_id);
                return (
                  <tr key={payment.id}>
                    <td className="px-5 py-4 font-bold text-ink">{dateLabel(payment.created_at.slice(0, 10))}</td>
                    <td className="px-5 py-4 text-ink/70">{business?.name || "Unknown"}</td>
                    <td className="px-5 py-4 font-black text-ink">{currency(payment.amount)}</td>
                    <td className="px-5 py-4">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{payment.status.replaceAll("_", " ")}</span>
                    </td>
                    <td className="px-5 py-4">{payment.receipt_image_url ? "Uploaded" : "None"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
