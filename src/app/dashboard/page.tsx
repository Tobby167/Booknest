import Link from "next/link";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  DollarSign,
  ListChecks,
  MessageSquareText,
  ThumbsUp
} from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { currency, dateLabel, timeLabel } from "@/lib/format";
import { getOwnedBusiness } from "@/lib/api";

function todayIso(offset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

function compactDate(date: Date) {
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function firstName(name?: string | null) {
  if (!name) return "there";
  return name.trim().split(/\s+/)[0] || "there";
}

function statusTone(status: string) {
  if (status === "confirmed" || status === "completed") return "bg-emerald-50 text-emerald-600";
  if (status === "pending" || status === "pending_confirmation") return "bg-amber-50 text-amber-600";
  if (status === "cancelled" || status === "no_show") return "bg-rose-50 text-rose-600";
  return "bg-purple-50 text-purple-600";
}

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function serviceName(row: { services?: { name?: string | null } | null }) {
  return row.services?.name || "Appointment";
}

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const business = await getOwnedBusiness(supabase);

  if (!business) {
    return (
      <div className="card p-6">
        <h1 className="text-2xl font-black text-ink">Set up your business profile</h1>
        <p className="mt-2 text-ink/65">Create your business profile before adding services and taking bookings.</p>
        <Link className="btn btn-primary mt-5" href="/dashboard/setup">
          Open setup guide
        </Link>
      </div>
    );
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: appointments }, { data: notifications }] = await Promise.all([
    supabase.from("profiles").select("full_name,email").eq("id", user?.id ?? "").maybeSingle(),
    supabase
      .from("appointments")
      .select("*, services(name)")
      .eq("business_id", business.id)
      .order("appointment_date", { ascending: true })
      .order("start_time", { ascending: true }),
    supabase
      .from("notifications")
      .select("*")
      .eq("business_id", business.id)
      .order("created_at", { ascending: false })
      .limit(5)
  ]);

  const rows = appointments ?? [];
  const today = todayIso();
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay() + 1);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const upcoming = rows
    .filter((row) => row.appointment_date >= today && !["cancelled", "completed", "no_show"].includes(row.status))
    .slice(0, 5);

  const confirmedRevenue = rows
    .filter((row) => row.payment_status === "confirmed")
    .reduce((total, row) => total + Number(row.total_price || 0), 0);

  const statCards = [
    {
      label: "Total Appointments",
      value: rows.length,
      note: `${rows.filter((row) => row.appointment_date >= today).length} upcoming`,
      icon: CalendarDays,
      tone: "bg-purple-100 text-purple-600"
    },
    {
      label: "Pending",
      value: rows.filter((row) => row.status === "pending" || row.status === "pending_confirmation").length,
      note: "View pending",
      icon: Clock3,
      tone: "bg-amber-100 text-amber-600"
    },
    {
      label: "Confirmed",
      value: rows.filter((row) => row.status === "confirmed").length,
      note: "View confirmed",
      icon: CheckCircle2,
      tone: "bg-emerald-100 text-emerald-600"
    },
    {
      label: "Completed",
      value: rows.filter((row) => row.status === "completed").length,
      note: "Finished bookings",
      icon: ThumbsUp,
      tone: "bg-violet-100 text-violet-600"
    },
    {
      label: "Revenue",
      value: currency(confirmedRevenue),
      note: "Manually confirmed",
      icon: DollarSign,
      tone: "bg-green-100 text-green-600"
    }
  ] as const;

  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(weekStart);
    day.setDate(weekStart.getDate() + index);
    const iso = day.toISOString().slice(0, 10);
    return {
      label: day.toLocaleDateString([], { weekday: "short" }),
      count: rows.filter((row) => row.appointment_date === iso).length
    };
  });
  const maxCount = Math.max(...weekDays.map((day) => day.count), 1);
  const points = weekDays
    .map((day, index) => {
      const x = 44 + index * 72;
      const y = 170 - (day.count / maxCount) * 110;
      return `${x},${y}`;
    })
    .join(" ");
  const fillPoints = `44,190 ${points} ${44 + 6 * 72},190`;

  const activityRows = [
    ...(notifications ?? []).map((notification) => ({
      title: notification.title || "Notification",
      message: notification.message || "New dashboard activity",
      time: new Date(notification.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      icon: MessageSquareText,
      tone: "bg-purple-50 text-purple-600"
    })),
    ...rows
      .slice()
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
      .slice(0, 5)
      .map((row) => ({
        title: `New booking from ${row.client_name}`,
        message: serviceName(row),
        time: dateLabel(row.appointment_date),
        icon: ListChecks,
        tone: "bg-emerald-50 text-emerald-600"
      }))
  ].slice(0, 5);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-ink sm:text-3xl">Welcome back, {firstName(profile?.full_name || profile?.email)}!</h1>
          <p className="mt-1 text-sm text-ink/60">Here&apos;s what&apos;s happening with {business.name} today.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-ink/75 shadow-sm">
            {compactDate(weekStart)} - {compactDate(weekEnd)}, {weekEnd.getFullYear()}
          </div>
          <Link className="rounded-xl border border-slate-200 bg-white p-2.5 text-ink/60 shadow-sm hover:text-purple-600" href="/dashboard/calendar">
            <CalendarDays className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm" key={card.label}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-ink/55">{card.label}</p>
                  <p className="mt-2 text-2xl font-black text-ink">{card.value}</p>
                  <p className="mt-1 text-xs font-bold text-emerald-600">{card.note}</p>
                </div>
                <span className={`rounded-full p-2.5 ${card.tone}`}>
                  <Icon className="h-5 w-5" />
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_1.12fr]">
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-black text-ink">Upcoming Appointments</h2>
            <Link className="text-xs font-black text-purple-600" href="/dashboard/appointments">
              View all
            </Link>
          </div>
          <div className="mt-4 divide-y divide-slate-100">
            {upcoming.length ? (
              upcoming.map((row) => (
                <div className="grid grid-cols-[72px_1fr_auto] items-center gap-3 py-3" key={row.id}>
                  <div>
                    <p className="text-sm font-black text-ink">{timeLabel(row.start_time)}</p>
                    <p className="text-xs text-ink/45">{row.appointment_date === today ? "Today" : dateLabel(row.appointment_date)}</p>
                  </div>
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-purple-500 to-fuchsia-500 text-sm font-black text-white">
                      {initials(row.client_name)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-ink">{row.client_name}</p>
                      <p className="truncate text-xs text-ink/55">{serviceName(row)}</p>
                    </div>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-black capitalize ${statusTone(row.status)}`}>{row.status.replace("_", " ")}</span>
                </div>
              ))
            ) : (
              <div className="rounded-xl bg-slate-50 p-5 text-sm font-bold text-ink/55">No upcoming appointments yet.</div>
            )}
          </div>
        </section>

        <div className="space-y-5">
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-black text-ink">Bookings Overview</h2>
              <span className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-black text-ink/55">This Week</span>
            </div>
            <div className="mt-4 overflow-hidden rounded-xl bg-gradient-to-b from-purple-50/70 to-white">
              <svg aria-label="Weekly bookings chart" className="h-56 w-full" viewBox="0 0 520 220" preserveAspectRatio="xMidYMid meet" role="img">
                <defs>
                  <linearGradient id="bookingsFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.28" />
                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {[40, 80, 120, 160].map((y) => (
                  <line key={y} stroke="#e2e8f0" strokeWidth="1" x1="32" x2="488" y1={y} y2={y} />
                ))}
                <polygon fill="url(#bookingsFill)" points={fillPoints} />
                <polyline fill="none" points={points} stroke="#7c3aed" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
                {weekDays.map((day, index) => {
                  const x = 44 + index * 72;
                  const y = 170 - (day.count / maxCount) * 110;
                  return (
                    <g key={day.label}>
                      <circle cx={x} cy={y} fill="white" r="5" stroke="#7c3aed" strokeWidth="3" />
                      <text fill="#64748b" fontSize="12" fontWeight="700" textAnchor="middle" x={x} y="210">
                        {day.label}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-black text-ink">Recent Activity</h2>
              <Link className="text-xs font-black text-purple-600" href="/dashboard/notifications">
                View all
              </Link>
            </div>
            <div className="mt-4 space-y-3">
              {activityRows.length ? (
                activityRows.map((activity, index) => {
                  const Icon = activity.icon;
                  return (
                    <div className="flex items-center gap-3" key={`${activity.title}-${index}`}>
                      <span className={`grid h-8 w-8 place-items-center rounded-full ${activity.tone}`}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-ink">{activity.title}</p>
                        <p className="truncate text-xs text-ink/50">{activity.message}</p>
                      </div>
                      <span className="text-xs font-bold text-ink/40">{activity.time}</span>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-xl bg-slate-50 p-5 text-sm font-bold text-ink/55">Activity will appear here after bookings start.</div>
              )}
            </div>
          </section>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link className="btn btn-primary" href={`/book/${business.slug}`}>
          View public page
        </Link>
        <Link className="btn btn-secondary" href="/dashboard/embed-code">
          Copy embed code
        </Link>
      </div>
    </div>
  );
}
