import Link from "next/link";
import { Building2, LayoutDashboard, LogOut, ShieldCheck, Megaphone, Activity, BotMessageSquare, Download } from "lucide-react";

const links = [
  { href: "/admin", label: "Control Center", icon: LayoutDashboard },
  { href: "/admin/businesses", label: "Businesses", icon: Building2 },
  { href: "/admin/broadcasts", label: "Broadcasts", icon: Megaphone },
  { href: "/admin/activity", label: "Activity Logs", icon: Activity },
  { href: "/admin/ai-logs", label: "AI Monitoring", icon: BotMessageSquare },
  { href: "/admin/exports", label: "Data Exports", icon: Download }
];

export function AdminNav() {
  return (
    <aside className="border-b border-slate-800 bg-slate-950 text-white lg:sticky lg:top-0 lg:h-screen lg:w-56 lg:overflow-y-auto lg:border-b-0 lg:border-r lg:border-slate-800">
      <div className="flex items-center justify-between gap-2 border-b border-white/10 p-3">
        <Link className="flex items-center gap-2 font-black" href="/admin">
          <ShieldCheck className="h-5 w-5 text-purple-300" />
          BookNest Admin
        </Link>
        <Link className="rounded-lg p-1.5 text-white/65 hover:bg-white/10 hover:text-white" href="/logout" title="Logout">
          <LogOut className="h-4 w-4" />
        </Link>
      </div>
      <nav className="flex gap-2 overflow-x-auto p-2 lg:grid lg:gap-1 lg:overflow-visible">
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <Link className="flex shrink-0 items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-black text-white/72 hover:bg-white/10 hover:text-white" href={link.href} key={link.href}>
              <Icon className="h-3.5 w-3.5 text-purple-300" />
              {link.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
