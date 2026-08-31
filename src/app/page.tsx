import Link from "next/link";
import { CalendarDays, LayoutDashboard, MonitorSmartphone } from "lucide-react";
import { PwaInstallButton } from "@/components/PwaInstallButton";

export default function HomePage() {
  const features = [
    ["Dashboard", "Manage services, appointments, receipts, and reminders.", LayoutDashboard],
    ["Public booking", "Clients choose services, options, add-ons, dates, and time slots.", CalendarDays],
    ["Iframe embed", "Use /embed/[businessSlug] inside another website.", MonitorSmartphone]
  ] as const;

  return (
    <main className="min-h-screen">
      <section className="mx-auto grid min-h-screen max-w-6xl items-center gap-8 px-5 py-10 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <div className="mb-8 flex items-start justify-between gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt="BookNest" className="h-16 w-auto" src="/booknest-logo.svg" />
            <PwaInstallButton />
          </div>
          <p className="mb-3 text-sm font-black uppercase tracking-[0.18em] text-fern">BookNest Booking Platform</p>
          <h1 className="text-4xl font-black leading-tight text-ink sm:text-5xl">
            Booking, receipts, reminders, and embeds for service businesses.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-ink/70">
            Run appointments from one clean dashboard, share a public booking link, embed booking on any website, collect receipts, and keep clients organized from booking to follow-up.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link className="btn btn-primary" href="/signup">
              Create owner account
            </Link>
            <Link className="btn btn-secondary" href="/login">
              Owner login
            </Link>
            <Link className="btn btn-secondary" href="/client/login">
              Client login
            </Link>
          </div>
        </div>

        <div className="card p-5">
          <div className="grid gap-3">
            {features.map(([title, body, Icon]) => (
              <div key={String(title)} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blush text-fern">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h2 className="font-black text-ink">{title}</h2>
                </div>
                <p className="mt-2 text-sm leading-6 text-ink/68">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
