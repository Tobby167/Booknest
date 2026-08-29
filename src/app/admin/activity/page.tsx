import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Activity, Bell, Building2, CreditCard } from "lucide-react";

type AuditRow = {
  id: string;
  business_id: string;
  event_type: string;
  message: string;
  created_at: string;
  business?: { name: string; slug: string };
};

export const revalidate = 0; // Force dynamic to always show live feed

export default async function AdminActivityPage() {
  const supabase = await createSupabaseServerClient();

  const { data: logs, error: logsError } = await supabase
    .from("audit_logs")
    .select("id, business_id, event_type, message, created_at, business:businesses(name, slug)")
    .order("created_at", { ascending: false })
    .limit(50);

  if (logsError) {
    console.error("Activity logs query error:", logsError.message);
  }

  function getEventIcon(type: string) {
    if (type === "business_created") return <Building2 className="h-5 w-5 text-purple-600" />;
    if (type === "appointment_booked") return <Bell className="h-5 w-5 text-emerald-600" />;
    if (type === "payment_confirmed") return <CreditCard className="h-5 w-5 text-sky-600" />;
    if (type === "payment_rejected") return <CreditCard className="h-5 w-5 text-rose-600" />;
    if (type === "appointment_status_updated") return <Activity className="h-5 w-5 text-amber-600" />;
    return <Activity className="h-5 w-5 text-slate-600" />;
  }

  function getEventTone(type: string) {
    if (type === "business_created") return "bg-purple-100 border-purple-200";
    if (type === "appointment_booked") return "bg-emerald-100 border-emerald-200";
    if (type === "payment_confirmed") return "bg-sky-100 border-sky-200";
    if (type === "payment_rejected") return "bg-rose-100 border-rose-200";
    if (type === "appointment_status_updated") return "bg-amber-100 border-amber-200";
    return "bg-slate-100 border-slate-200";
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-purple-600">Super admin</p>
        <h1 className="mt-2 text-2xl font-black text-ink sm:text-3xl">Live Activity Log</h1>
        <p className="mt-2 text-sm leading-6 text-ink/60">The Watcher: Real-time feed of all platform events, powered by Postgres Triggers.</p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm min-h-[500px]">
        <div className="space-y-6">
          {(logs as unknown as AuditRow[] ?? []).map((log) => (
            <div key={log.id} className="relative flex gap-4">
              <div className="absolute left-6 top-8 bottom-[-24px] w-0.5 bg-slate-100 last:hidden" />
              
              <div className={`relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 bg-white ${getEventTone(log.event_type)}`}>
                {getEventIcon(log.event_type)}
              </div>
              
              <div className="flex-1 pt-2.5 pb-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-black text-ink">{log.business?.name || "Unknown Business"}</p>
                  <p className="text-xs font-bold text-ink/40">
                    {new Date(log.created_at).toLocaleString()}
                  </p>
                </div>
                <p className="mt-1 text-sm text-ink/70">{log.message}</p>
              </div>
            </div>
          ))}
          
          {(!logs || logs.length === 0) && (
            <div className="flex h-[300px] flex-col items-center justify-center text-center">
              <Activity className="h-10 w-10 text-ink/20" />
              <h3 className="mt-4 text-lg font-black text-ink">No activity yet</h3>
              <p className="mt-1 text-sm text-ink/50">Events will automatically appear here when businesses act.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
