"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Megaphone, Plus, Trash2, Power, PowerOff } from "lucide-react";

type BroadcastRow = {
  id: string;
  title: string;
  message: string;
  tone: string;
  is_active: boolean;
  created_at: string;
};

export function BroadcastManager({ broadcasts }: { broadcasts: BroadcastRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const [form, setForm] = useState({ title: "", message: "", tone: "blue" });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/broadcasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create broadcast");
      
      setForm({ title: "", message: "", tone: "blue" });
      setIsCreating(false);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleToggle(id: string, currentStatus: boolean) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/broadcasts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, is_active: !currentStatus })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to toggle broadcast");
      
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {error && <div className="rounded-lg bg-red-50 p-4 text-sm font-bold text-red-600 border border-red-200">{error}</div>}

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black text-ink">Active & Past Broadcasts</h2>
        {!isCreating && (
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-purple-700"
          >
            <Plus className="h-4 w-4" />
            New Broadcast
          </button>
        )}
      </div>

      {isCreating && (
        <form onSubmit={handleCreate} className="rounded-xl border border-purple-200 bg-purple-50/50 p-6 shadow-sm">
          <h3 className="text-lg font-black text-ink flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-purple-600" />
            Create Megaphone Broadcast
          </h3>
          <p className="mt-1 text-sm text-ink/60">This will instantly appear as an alert bar on every business dashboard.</p>
          
          <div className="mt-5 space-y-4">
            <div>
              <label className="text-xs font-bold text-ink/60">Title (Short)</label>
              <input
                type="text"
                required
                className="input focus-ring mt-1 bg-white"
                placeholder="e.g. Platform Update: New WhatsApp Bot"
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-ink/60">Message</label>
              <textarea
                required
                className="input focus-ring mt-1 bg-white min-h-[100px]"
                placeholder="Type your global announcement here..."
                value={form.message}
                onChange={e => setForm({ ...form, message: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-ink/60">Alert Tone (Color)</label>
              <select
                className="input focus-ring mt-1 bg-white"
                value={form.tone}
                onChange={e => setForm({ ...form, tone: e.target.value })}
              >
                <option value="blue">Blue (Information)</option>
                <option value="emerald">Green (Success / Launch)</option>
                <option value="amber">Amber (Warning / Maintenance)</option>
                <option value="red">Red (Critical Alert)</option>
              </select>
            </div>
            
            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-purple-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-purple-700 disabled:opacity-50"
              >
                Publish Globally
              </button>
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                disabled={busy}
                className="rounded-lg px-5 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-100"
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {broadcasts.map(b => (
          <div key={b.id} className={`rounded-xl border p-5 shadow-sm transition ${b.is_active ? 'border-purple-200 bg-white' : 'border-slate-100 bg-slate-50 opacity-60'}`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-black text-ink">{b.title}</h4>
                  {b.is_active && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black uppercase text-emerald-700">Live</span>}
                </div>
                <p className="mt-2 text-sm text-ink/70">{b.message}</p>
                <div className="mt-3 text-xs font-bold text-ink/40">
                  Tone: {b.tone} • Created: {new Date(b.created_at).toLocaleDateString()}
                </div>
              </div>
              <button
                onClick={() => handleToggle(b.id, b.is_active)}
                disabled={busy}
                className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition disabled:opacity-50 ${
                  b.is_active 
                    ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200' 
                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                }`}
              >
                {b.is_active ? <><PowerOff className="h-3 w-3"/> Disable</> : <><Power className="h-3 w-3"/> Re-enable</>}
              </button>
            </div>
          </div>
        ))}
        {broadcasts.length === 0 && !isCreating && (
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-8 text-center text-sm font-bold text-ink/50">
            No broadcasts created yet. Click "New Broadcast" to send your first platform-wide message!
          </div>
        )}
      </div>
    </div>
  );
}
