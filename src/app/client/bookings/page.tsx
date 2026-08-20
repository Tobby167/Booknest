import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { CalendarCheck2, CalendarDays, Clock, LogOut, Store, ChevronLeft } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { currencyFor, dateLabel, timeLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

type AppointmentRow = {
  id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: string;
  payment_status: string;
  total_price: number | null;
  coupon_code: string | null;
  discount_amount: number | null;
  service_discount_name: string | null;
  service_discount_amount: number | null;
  businesses?: { name: string; slug: string; currency?: string | null } | null;
  services?: { name: string } | null;
  service_options?: { name: string } | null;
};

export default async function ClientBookingsPage({ searchParams }: { searchParams?: Promise<{ next?: string }> }) {
  const resolvedParams = await (searchParams ?? Promise.resolve({} as { next?: string }));
  const nextPath = typeof resolvedParams.next === "string" && resolvedParams.next.startsWith("/book/") ? resolvedParams.next : null;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) redirect("/client/login");

  const { data: profile } = await supabase.from("profiles").select("role,full_name,email").eq("id", user.id).maybeSingle();

  const { data: appointments } = await supabase
    .from("appointments")
    .select("id,appointment_date,start_time,end_time,status,payment_status,total_price,coupon_code,discount_amount,service_discount_name,service_discount_amount,businesses(name,slug,currency),services(name),service_options(name)")
    .eq("client_auth_user_id", user.id)
    .order("appointment_date", { ascending: true })
    .order("start_time", { ascending: true });

  const rows = (appointments ?? []) as unknown as AppointmentRow[];
  const activeRows = rows.filter((appointment) => !["cancelled", "completed", "no_show"].includes(appointment.status));
  const businessCount = new Set(rows.map((appointment) => appointment.businesses?.slug).filter(Boolean)).size;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-5xl mb-8 flex items-center justify-between border-b border-slate-200 pb-4">
        <Link href="/client/bookings" className="transition hover:opacity-85">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="BookNest" className="h-8 w-auto" src="/booknest-logo.svg" />
        </Link>
        {nextPath && (
          <Link
            href={nextPath}
            className="flex items-center gap-1.5 text-xs font-black uppercase tracking-[0.14em] text-purple-600 hover:text-purple-950 transition"
          >
            <ChevronLeft className="h-4 w-4" /> Back to Booking
          </Link>
        )}
      </div>

      <section className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.16em] text-purple-600">BookNest Client</p>
            <h1 className="mt-2 text-3xl font-black text-ink">My bookings</h1>
            <p className="mt-2 text-sm text-ink/60">Bookings tied to your BookNest account across businesses.</p>
            {profile?.role && profile.role !== "client" ? (
              <p className="mt-2 max-w-2xl text-sm font-bold text-purple-700">
                You are signed in with an owner account, but you can still use this same login to book as a client.
              </p>
            ) : null}
          </div>
          <div className="flex gap-3">
            <Link className="btn btn-secondary" href="/">
              Find booking pages
            </Link>
            <Link className="btn btn-primary" href="/logout?next=/client/login">
              <LogOut className="h-4 w-4" /> Logout
            </Link>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:col-span-3">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-purple-50 text-purple-600">
                <CalendarDays className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-black text-ink">{profile?.full_name || user.email}</h2>
                <p className="text-sm text-ink/60">{profile?.email || user.email}</p>
              </div>
            </div>
          </div>

          <SummaryCard icon={<CalendarCheck2 className="h-5 w-5" />} label="Saved bookings" value={rows.length} />
          <SummaryCard icon={<Clock className="h-5 w-5" />} label="Active bookings" value={activeRows.length} />
          <SummaryCard icon={<Store className="h-5 w-5" />} label="Businesses booked" value={businessCount} />
        </div>

        <div className="mt-6 rounded-xl border border-purple-200 bg-purple-50 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div>
              <h2 className="font-black text-ink">Tip for future bookings</h2>
              <p className="mt-1 text-sm font-bold leading-6 text-ink/65">
                Login before choosing a time. BookNest will save the appointment here and warn you if you already have another booking at that same time.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-xl font-black text-ink">Upcoming and past bookings</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {rows.map((appointment) => {
              const currency = appointment.businesses?.currency || "USD";
              return (
                <article className="grid gap-4 p-5 md:grid-cols-[1fr_auto]" key={appointment.id}>
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-purple-600">
                      {appointment.businesses?.name ?? "Business"}
                    </p>
                    <h3 className="mt-2 text-lg font-black text-ink">
                      {[appointment.services?.name, appointment.service_options?.name].filter(Boolean).join(" - ") || "Appointment"}
                    </h3>
                    <p className="mt-2 text-sm font-bold text-ink/60">
                      {dateLabel(appointment.appointment_date)} at {timeLabel(appointment.start_time)} - {timeLabel(appointment.end_time)}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs font-black uppercase tracking-[0.08em]">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">{appointment.status}</span>
                      <span className="rounded-full bg-purple-50 px-3 py-1 text-purple-600">{appointment.payment_status}</span>
                      {appointment.service_discount_name ? <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-600">{appointment.service_discount_name}</span> : null}
                      {appointment.coupon_code ? <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-600">{appointment.coupon_code}</span> : null}
                    </div>
                  </div>
                  <div className="text-left md:text-right">
                    <p className="text-lg font-black text-ink">{currencyFor(appointment.total_price, currency)}</p>
                    {appointment.service_discount_amount ? (
                      <p className="mt-1 text-sm font-bold text-emerald-600">
                        Service discount saved {currencyFor(appointment.service_discount_amount, currency)}
                      </p>
                    ) : null}
                    {appointment.discount_amount ? <p className="mt-1 text-sm font-bold text-emerald-600">Saved {currencyFor(appointment.discount_amount, currency)}</p> : null}
                    {appointment.businesses?.slug ? (
                      <Link className="mt-4 inline-flex text-sm font-black text-purple-600" href={`/book/${appointment.businesses.slug}`}>
                        Book again
                      </Link>
                    ) : null}
                  </div>
                </article>
              );
            })}
            {rows.length === 0 ? (
              <div className="p-8 text-center">
                <h3 className="text-xl font-black text-ink">No bookings yet</h3>
                <p className="mt-2 text-sm text-ink/60">When you book while logged in, your appointments will show here.</p>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}

function SummaryCard({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-ink/55">{label}</p>
          <p className="mt-2 text-3xl font-black text-ink">{value}</p>
        </div>
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-purple-50 text-purple-600">{icon}</div>
      </div>
    </div>
  );
}
