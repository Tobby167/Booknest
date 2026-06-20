"use client";

import Link from "next/link";
import { Copy, Mail, ShieldCheck } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { BookNestLoader } from "@/components/BookNestLoader";
import { getSiteUrl } from "@/lib/env";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Business } from "@/lib/types";

export function OwnerTransferPanel() {
  const [business, setBusiness] = useState<Business | null>(null);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/business/settings")
      .then((response) => response.json())
      .then((data) => {
        setBusiness(data.business ?? null);
        setEmail(data.business?.email ?? "");
      })
      .finally(() => setLoading(false));
  }, []);

  const siteUrl = getSiteUrl();
  const loginUrl = `${siteUrl}/login`;
  const resetUrl = `${siteUrl}/forgot-password`;
  const bookingUrl = business ? `${siteUrl}/book/${business.slug}` : "";

  async function copy(value: string, label: string) {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    window.setTimeout(() => setCopied(""), 1500);
  }

  async function transfer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextEmail = email.trim().toLowerCase();
    if (!nextEmail) {
      setMessage("Enter the new owner's email first.");
      return;
    }

    setBusy(true);
    setMessage("");
    const supabase = createSupabaseBrowserClient();
    const { error: authError } = await supabase.auth.updateUser(
      { email: nextEmail },
      { emailRedirectTo: `${siteUrl}/dashboard` }
    );

    if (authError) {
      setBusy(false);
      setMessage(authError.message);
      return;
    }

    if (business) {
      const response = await fetch("/api/business/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: business.name,
          slug: business.slug,
          description: business.description ?? "",
          phone: business.phone ?? "",
          email: nextEmail,
          address: business.address ?? "",
          logo_url: business.logo_url ?? "",
          bank_name: business.bank_name ?? "",
          bank_account_name: business.bank_account_name ?? "",
          bank_account_number: business.bank_account_number ?? "",
          booking_requires_owner_confirmation: business.booking_requires_owner_confirmation
        })
      });
      const payload = await response.json();
      if (!response.ok) {
        setBusy(false);
        setMessage(payload.error || "Business email could not be updated.");
        return;
      }
      setBusiness(payload.business);
    }

    await supabase.auth.resetPasswordForEmail(nextEmail, {
      redirectTo: `${siteUrl}/reset-password`
    });

    setBusy(false);
    setMessage(
      "Handoff started. Supabase sent an email-change confirmation and a password reset email. The new owner should confirm the email first, then reset the password."
    );
  }

  if (loading) return <BookNestLoader label="Loading transfer page" />;

  if (!business) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-black text-ink">Create the business first</h1>
        <p className="mt-2 text-sm leading-6 text-ink/60">Owner transfer is available after this account has a business profile.</p>
        <Link className="btn btn-primary mt-5" href="/dashboard/settings">
          Open settings
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-purple-600">Owner handoff</p>
        <h1 className="mt-2 text-2xl font-black text-ink sm:text-3xl">Transfer {business.name}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/60">
          Use this when you built the booking site for a client. It changes the login email and sends the new owner the emails they need to take over.
        </p>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1fr_0.9fr]">
        <form className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" onSubmit={transfer}>
          <h2 className="font-black text-ink">New owner email</h2>
          <label className="mt-4 block">
            <span className="label">Email address</span>
            <input className="input focus-ring" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <button className="btn btn-primary mt-4" disabled={busy}>
            <Mail className="h-4 w-4" /> {busy ? "Starting handoff..." : "Start owner handoff"}
          </button>
          {message ? <p className="mt-4 rounded-xl bg-purple-50 p-3 text-sm font-bold leading-6 text-ink">{message}</p> : null}
        </form>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <h2 className="font-black text-ink">What the owner receives</h2>
          </div>
          <div className="mt-4 space-y-3 text-sm leading-6 text-ink/65">
            <p>1. Supabase email-change confirmation.</p>
            <p>2. Supabase password reset email.</p>
            <p>3. Access to their dashboard after they confirm and reset.</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-black text-ink">Useful links to send manually</h2>
        <div className="mt-4 grid gap-3">
          {[
            ["Login", loginUrl],
            ["Reset password", resetUrl],
            ["Public booking page", bookingUrl]
          ].map(([label, value]) => (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4" key={label}>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-ink/45">{label}</p>
              <p className="mt-2 break-all text-sm font-bold text-ink">{value}</p>
              <button className="btn btn-secondary mt-3" onClick={() => copy(value, label)} type="button">
                <Copy className="h-4 w-4" /> Copy
              </button>
            </div>
          ))}
        </div>
        {copied ? <p className="mt-3 text-sm font-black text-emerald-600">{copied} copied.</p> : null}
      </section>
    </div>
  );
}
