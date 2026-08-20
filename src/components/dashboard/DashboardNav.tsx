"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import {
  Bell,
  CalendarDays,
  CheckCircle2,
  Clock,
  Code,
  CreditCard,
  BadgePercent,
  Handshake,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  Plug,
  Scissors,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
  Lock
} from "lucide-react";

const groups = [
  {
    key: "workspace",
    label: "Workspace",
    icon: LayoutDashboard,
    links: [
      { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
      { href: "/dashboard/setup", label: "Setup Guide", icon: CheckCircle2 }
    ]
  },
  {
    key: "catalog",
    label: "Service Catalog",
    icon: Scissors,
    links: [
      { href: "/dashboard/services", label: "Services", icon: Scissors },
      { href: "/dashboard/service-categories", label: "Categories", icon: Sparkles },
      { href: "/dashboard/service-options", label: "Options", icon: ListChecks },
      { href: "/dashboard/add-ons", label: "Add-ons", icon: Sparkles }
    ]
  },
  {
    key: "schedule",
    label: "Schedule",
    icon: CalendarDays,
    links: [
      { href: "/dashboard/appointments", label: "Appointments", icon: ListChecks },
      { href: "/dashboard/availability", label: "Availability", icon: Clock },
      { href: "/dashboard/calendar", label: "Calendar", icon: CalendarDays }
    ]
  },
  {
    key: "growth",
    label: "Clients & Money",
    icon: Users,
    links: [
      { href: "/dashboard/clients", label: "Clients", icon: Users },
      { href: "/dashboard/coupons", label: "Coupons", icon: BadgePercent },
      { href: "/dashboard/discounts", label: "Discounts", icon: BadgePercent },
      { href: "/dashboard/payments", label: "Payments", icon: CreditCard }
    ]
  },
  {
    key: "followups",
    label: "Follow-ups",
    icon: Bell,
    links: [
      { href: "/dashboard/notifications", label: "Notifications", icon: Bell },
      { href: "/dashboard/reminders", label: "Reminders", icon: Bell }
    ]
  },
  {
    key: "control",
    label: "Control Center",
    icon: Settings,
    links: [
      { href: "/dashboard/embed-code", label: "Embed Code", icon: Code },
      { href: "/dashboard/integrations", label: "Integrations", icon: Plug },
      { href: "/dashboard/transfer-owner", label: "Transfer Owner", icon: Handshake },
      { href: "/admin", label: "Admin", icon: ShieldCheck },
      { href: "/dashboard/settings", label: "Settings", icon: Settings }
    ]
  }
];

export function DashboardNav({ plan = "starter", isLifetime = false }: { plan?: string; isLifetime?: boolean }) {
  const pathname = usePathname();
  const activeGroupKey = useMemo(() => {
    return groups.find((group) => group.links.some((link) => link.href === pathname))?.key ?? "workspace";
  }, [pathname]);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ [activeGroupKey]: true });
  const [mobileOpen, setMobileOpen] = useState(false);

  function isFeatureLocked(href: string) {
    if (isLifetime) return false;
    
    // Starter locks
    if (plan === "starter") {
      if (href === "/dashboard/reminders") return true;
    }
    
    // Starter & Growth locks
    if (plan === "starter" || plan === "growth") {
      if (href === "/dashboard/clients" || href === "/dashboard/coupons" || href === "/dashboard/discounts") return true;
    }
    
    // Starter, Growth, & Pro locks
    if (plan === "starter" || plan === "growth" || plan === "pro") {
      if (href === "/dashboard/integrations") return true;
    }
    
    return false;
  }

  function toggleGroup(key: string) {
    setOpenGroups((current) => ({ ...current, [key]: !current[key] }));
  }

  function NavContent({ mobile = false }: { mobile?: boolean }) {
    return (
      <nav className="grid gap-1.5 p-3">
        {groups.map((group) => {
          const GroupIcon = group.icon;
          const isOpen = openGroups[group.key] ?? group.key === activeGroupKey;
          const isActiveGroup = group.links.some((link) => link.href === pathname);
          return (
            <div key={group.key}>
              <button
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-black transition ${
                  isActiveGroup ? "bg-white/12 text-white" : "text-white/72 hover:bg-white/10 hover:text-white"
                }`}
                onClick={() => toggleGroup(group.key)}
                type="button"
              >
                <GroupIcon className="h-3.5 w-3.5 text-purple-300" />
                <span className="truncate">{group.label}</span>
              </button>
              {isOpen ? (
                <div className="ml-6 mt-1 grid gap-1 rounded-xl border-l border-white/10 bg-black/12 py-1 pl-3 pr-1 lg:ml-5 lg:bg-transparent lg:pl-3">
                  {group.links.map((link) => {
                    const Icon = link.icon;
                    const active = pathname === link.href;
                    const locked = isFeatureLocked(link.href);
                    return (
                      <Link
                        className={`flex items-center justify-between rounded-lg px-2.5 py-2 text-xs font-black transition ${
                          active ? "bg-purple-500 text-white shadow-sm" : "text-white/62 hover:bg-white/10 hover:text-white"
                        } ${locked ? "opacity-60 grayscale" : ""}`}
                        href={locked ? "/dashboard/billing" : link.href}
                        key={link.href}
                        onClick={() => {
                          if (mobile) setMobileOpen(false);
                        }}
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <Icon className="h-3.5 w-3.5 shrink-0 text-purple-200" />
                          <span className="truncate">{link.label}</span>
                        </div>
                        {locked && <Lock className="h-3 w-3 shrink-0 text-white/40" />}
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>
    );
  }

  return (
    <>
      <header className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between border-b border-slate-800 bg-slate-950 px-3 py-2 text-white shadow-xl lg:hidden">
        <Link className="flex min-w-0 items-center gap-3" href="/dashboard">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="BookNest" className="h-7 w-auto max-w-28 object-contain" src="/booknest-logo-sidebar.svg" />
        </Link>
        <button
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          className="relative h-10 w-10 rounded-xl border border-white/10 bg-white/5 text-white transition hover:bg-white/10"
          onClick={() => setMobileOpen((current) => !current)}
          type="button"
        >
          <Menu className={`absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 transition ${mobileOpen ? "scale-75 opacity-0" : "scale-100 opacity-100"}`} />
          <span className={`absolute left-1/2 top-1/2 h-0.5 w-5 -translate-x-1/2 rounded-full bg-white transition ${mobileOpen ? "-translate-y-1/2 rotate-45 opacity-100" : "-translate-y-2 opacity-0"}`} />
          <span className={`absolute left-1/2 top-1/2 h-0.5 w-5 -translate-x-1/2 rounded-full bg-white transition ${mobileOpen ? "-translate-y-1/2 -rotate-45 opacity-100" : "translate-y-2 opacity-0"}`} />
        </button>
      </header>

      <div
        className={`fixed inset-0 z-40 bg-slate-950/55 backdrop-blur-sm transition lg:hidden ${mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={() => setMobileOpen(false)}
      />
      <aside
        className={`fixed bottom-0 left-0 top-0 z-50 w-[74vw] max-w-72 overflow-y-auto border-r border-slate-800 bg-slate-950 text-white shadow-2xl transition-transform duration-300 ease-out lg:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between gap-2 border-b border-white/10 p-3">
          <Link className="flex min-w-0 items-center gap-3" href="/dashboard" onClick={() => setMobileOpen(false)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt="BookNest" className="h-8 w-auto max-w-32 object-contain" src="/booknest-logo-sidebar.svg" />
          </Link>
          <button className="relative h-10 w-10 rounded-xl border border-white/10 bg-white/5" onClick={() => setMobileOpen(false)} type="button" aria-label="Close menu">
            <span className="absolute left-1/2 top-1/2 h-0.5 w-5 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-full bg-white" />
            <span className="absolute left-1/2 top-1/2 h-0.5 w-5 -translate-x-1/2 -translate-y-1/2 -rotate-45 rounded-full bg-white" />
          </button>
        </div>
        <NavContent mobile />
        <div className="border-t border-white/10 p-3">
          <Link className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-black text-white/72 hover:bg-white/10 hover:text-white" href="/logout" onClick={() => setMobileOpen(false)}>
            <LogOut className="h-3.5 w-3.5 text-purple-300" />
            Logout
          </Link>
        </div>
      </aside>

      <aside className="hidden border-r border-slate-800 bg-slate-950 text-white lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:block lg:w-52 lg:overflow-y-auto">
        <div className="flex items-center justify-between gap-2 border-b border-white/10 p-3">
          <Link className="flex min-w-0 items-center gap-3" href="/dashboard">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt="BookNest" className="h-8 w-auto max-w-32 object-contain" src="/booknest-logo-sidebar.svg" />
          </Link>
          <Link className="rounded-lg p-1.5 text-white/65 hover:bg-white/10 hover:text-white" href="/logout" title="Logout">
            <LogOut className="h-4 w-4" />
          </Link>
        </div>
        <NavContent />
      </aside>
    </>
  );
}
