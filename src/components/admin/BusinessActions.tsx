"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserCheck, ShieldAlert, CreditCard, Ban, Trash2 } from "lucide-react";

type BusinessActionsProps = {
  businessId: string;
  ownerEmail: string;
  currentPlan: string;
  isBanned: boolean;
};

export function BusinessActions({ businessId, ownerEmail, currentPlan, isBanned }: BusinessActionsProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleImpersonate() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: ownerEmail })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to impersonate");
      
      // Navigate to the magic link URL
      window.location.href = data.url;
    } catch (err: any) {
      setError(err.message);
      setBusy(false);
    }
  }

  async function handleUpdate(updates: Record<string, any>) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/businesses/${businessId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update business");
      
      router.refresh();
      setBusy(false);
    } catch (err: any) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {error && <div className="rounded-lg bg-blush p-4 text-sm font-bold text-ink">{error}</div>}

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-black text-ink">God Mode Actions</h3>
        <p className="mt-1 text-sm text-ink/60">Powerful tools that affect this user's account directly.</p>
        
        <div className="mt-5 space-y-3">
          <button
            onClick={handleImpersonate}
            disabled={busy}
            className="flex w-full items-center gap-3 rounded-lg bg-purple-600 px-4 py-3 font-bold text-white transition hover:bg-purple-700 disabled:opacity-50"
          >
            <UserCheck className="h-5 w-5" />
            <div className="text-left">
              <div className="text-sm">Impersonate Business</div>
              <div className="text-xs font-normal opacity-80">Log in seamlessly without a password</div>
            </div>
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-black text-ink">Subscription Status</h3>
        <div className="mt-4 flex items-center gap-3">
          <select
            className="input focus-ring flex-1 bg-slate-50"
            value={currentPlan}
            disabled={busy}
            onChange={(e) => handleUpdate({ plan: e.target.value })}
          >
            <option value="starter">Starter Plan</option>
            <option value="growth">Growth Plan</option>
            <option value="pro">Pro Plan</option>
            <option value="business">Business Plan</option>
          </select>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
            <CreditCard className="h-5 w-5" />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-red-200 bg-red-50 p-6 shadow-sm">
        <h3 className="flex items-center gap-2 text-lg font-black text-red-700">
          <ShieldAlert className="h-5 w-5" />
          Danger Zone
        </h3>
        <p className="mt-1 text-sm text-red-700/80">These actions instantly affect the live business page.</p>
        
        <div className="mt-5 space-y-3">
          <button
            onClick={() => handleUpdate({ is_banned: !isBanned })}
            disabled={busy}
            className="flex w-full items-center gap-3 rounded-lg bg-white px-4 py-3 font-bold text-red-700 border border-red-200 hover:bg-red-100 disabled:opacity-50 transition"
          >
            <Ban className="h-5 w-5" />
            <div className="text-left">
              <div className="text-sm">{isBanned ? "Unban Business" : "Ban Business"}</div>
              <div className="text-xs font-normal opacity-80">{isBanned ? "Restore their access" : "Immediately disable their page"}</div>
            </div>
          </button>
          
          <button
            disabled
            className="flex w-full items-center gap-3 rounded-lg bg-red-600 px-4 py-3 font-bold text-white transition opacity-50 cursor-not-allowed"
          >
            <Trash2 className="h-5 w-5" />
            <div className="text-left">
              <div className="text-sm">Delete Business (Coming Soon)</div>
              <div className="text-xs font-normal opacity-80">Permanently wipe all data</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
