"use client";

import { FormEvent, useEffect, useState } from "react";
import { Mail, Upload } from "lucide-react";
import { BookNestLoader } from "@/components/BookNestLoader";
import { getSiteUrl } from "@/lib/env";
import { slugify } from "@/lib/format";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Business } from "@/lib/types";

const emptyBusiness = {
  name: "",
  slug: "",
  description: "",
  phone: "",
  email: "",
  address: "",
  logo_url: "",
  bank_name: "",
  bank_account_name: "",
  bank_account_number: "",
  booking_requires_owner_confirmation: true,
  currency: "USD",
  timezone: "America/Chicago",
  cancellation_policy: "",
  default_deposit_required: false,
  default_deposit_amount: "",
  booking_notice_hours: 0,
  max_advance_booking_days: 90,
  default_buffer_after_minutes: 0
};

const currencyOptions = ["USD", "CAD", "GBP", "EUR", "NGN", "GHS", "ZAR"];
const timezoneOptions = [
  { value: "America/Chicago", label: "Texas / Central Time (America/Chicago)" },
  { value: "America/Denver", label: "Mountain Time / El Paso (America/Denver)" },
  { value: "America/New_York", label: "Eastern Time (America/New_York)" },
  { value: "America/Los_Angeles", label: "Pacific Time (America/Los_Angeles)" },
  { value: "America/Toronto", label: "Toronto / Eastern Time (America/Toronto)" },
  { value: "Europe/London", label: "London (Europe/London)" },
  { value: "Europe/Paris", label: "Paris (Europe/Paris)" },
  { value: "Africa/Lagos", label: "Lagos (Africa/Lagos)" },
  { value: "Africa/Accra", label: "Accra (Africa/Accra)" },
  { value: "Africa/Johannesburg", label: "Johannesburg (Africa/Johannesburg)" }
];

export function SettingsPanel() {
  const [business, setBusiness] = useState<Business | null>(null);
  const [form, setForm] = useState(emptyBusiness);
  const [message, setMessage] = useState("");
  const [handoffEmail, setHandoffEmail] = useState("");
  const [handoffMessage, setHandoffMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const siteUrl = getSiteUrl();

  useEffect(() => {
    fetch("/api/business/settings")
      .then((response) => response.json())
      .then((data) => {
        if (data.business) {
          setBusiness(data.business);
          setForm({
            name: data.business.name ?? "",
            slug: data.business.slug ?? "",
            description: data.business.description ?? "",
            phone: data.business.phone ?? "",
            email: data.business.email ?? "",
            address: data.business.address ?? "",
            logo_url: data.business.logo_url ?? "",
            bank_name: data.business.bank_name ?? "",
            bank_account_name: data.business.bank_account_name ?? "",
            bank_account_number: data.business.bank_account_number ?? "",
            booking_requires_owner_confirmation: data.business.booking_requires_owner_confirmation,
            currency: data.business.currency ?? "USD",
            timezone: data.business.timezone ?? "America/Chicago",
            cancellation_policy: data.business.cancellation_policy ?? "",
            default_deposit_required: data.business.default_deposit_required ?? false,
            default_deposit_amount: data.business.default_deposit_amount ?? "",
            booking_notice_hours: data.business.booking_notice_hours ?? 0,
            max_advance_booking_days: data.business.max_advance_booking_days ?? 90,
            default_buffer_after_minutes: data.business.default_buffer_after_minutes ?? 0
          });
          setHandoffEmail(data.business.email ?? "");
        }
      })
      .finally(() => setLoading(false));
  }, []);

  function setField(field: keyof typeof form, value: string | boolean | number) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/business/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    const data = await response.json();
    setBusy(false);

    if (!response.ok) {
      setMessage(data.error || "Settings could not be saved.");
      return;
    }

    setBusiness(data.business);
    setMessage("Business settings saved.");
  }

  async function uploadLogo(file: File | null) {
    if (!file || !business) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setMessage("Logo must be PNG, JPG, JPEG, or WebP.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setMessage("Logo must be 2 MB or smaller.");
      return;
    }

    setBusy(true);
    setMessage("");
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch("/api/business/logo", {
      method: "POST",
      body: formData
    });
    const payload = await response.json();
    setBusy(false);

    if (!response.ok) {
      setMessage(payload.error || "Logo URL could not be saved.");
      return;
    }

    setBusiness(payload.business);
    setForm((current) => ({ ...current, logo_url: payload.logoUrl }));
    setMessage("Logo uploaded.");
  }

  async function transferOwnerLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextEmail = handoffEmail.trim().toLowerCase();
    if (!nextEmail) {
      setHandoffMessage("Enter the new owner's email first.");
      return;
    }

    setBusy(true);
    setHandoffMessage("");
    const supabase = createSupabaseBrowserClient();
    const { error: authError } = await supabase.auth.updateUser(
      { email: nextEmail },
      { emailRedirectTo: `${siteUrl}/dashboard/settings` }
    );

    if (authError) {
      setBusy(false);
      setHandoffMessage(authError.message);
      return;
    }

    const response = await fetch("/api/business/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, email: nextEmail })
    });
    const payload = await response.json();

    if (!response.ok) {
      setBusy(false);
      setHandoffMessage(payload.error || "Business email could not be updated.");
      return;
    }

    await supabase.auth.resetPasswordForEmail(nextEmail, {
      redirectTo: `${siteUrl}/reset-password`
    });

    setBusiness(payload.business);
    setForm((current) => ({ ...current, email: nextEmail }));
    setBusy(false);
    setHandoffMessage(
      "Owner handoff started. Supabase sent an email-change confirmation and a password reset email to the new owner. They should confirm the email first, then reset the password."
    );
  }

  if (loading) return <BookNestLoader label="Loading settings" />;

  return (
    <div className="card p-5">
      <h1 className="text-2xl font-black text-ink">Business settings</h1>
      <p className="mt-2 text-sm leading-6 text-ink/65">Set the public booking profile, bank transfer details, and confirmation behavior.</p>

      <form className="mt-6 grid gap-4" onSubmit={save}>
        <div className="grid gap-4 md:grid-cols-2">
          <label>
            <span className="label">Business name</span>
            <input
              className="input focus-ring"
              value={form.name}
              onChange={(event) => {
                setField("name", event.target.value);
                if (!business) setField("slug", slugify(event.target.value));
              }}
              required
            />
          </label>
          <label>
            <span className="label">Slug</span>
            <input className="input focus-ring" value={form.slug} onChange={(event) => setField("slug", slugify(event.target.value))} required />
          </label>
          <label className="md:col-span-2">
            <span className="label">Description</span>
            <textarea className="input focus-ring min-h-24" value={form.description} onChange={(event) => setField("description", event.target.value)} />
          </label>
          <label>
            <span className="label">Phone</span>
            <input className="input focus-ring" value={form.phone} onChange={(event) => setField("phone", event.target.value)} />
          </label>
          <label>
            <span className="label">Email</span>
            <input className="input focus-ring" type="email" value={form.email} onChange={(event) => setField("email", event.target.value)} />
          </label>
          <label className="md:col-span-2">
            <span className="label">Address</span>
            <input className="input focus-ring" value={form.address} onChange={(event) => setField("address", event.target.value)} />
          </label>
        </div>

        <div className="rounded-lg border border-ink/10 bg-mist p-4">
          <h2 className="font-black text-ink">Bank transfer details</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <label>
              <span className="label">Bank name</span>
              <input className="input focus-ring" value={form.bank_name} onChange={(event) => setField("bank_name", event.target.value)} />
            </label>
            <label>
              <span className="label">Account name</span>
              <input className="input focus-ring" value={form.bank_account_name} onChange={(event) => setField("bank_account_name", event.target.value)} />
            </label>
            <label>
              <span className="label">Account number</span>
              <input className="input focus-ring" value={form.bank_account_number} onChange={(event) => setField("bank_account_number", event.target.value)} />
            </label>
          </div>
        </div>

        <label className="flex items-center gap-3 rounded-lg border border-ink/10 bg-white p-4 font-bold text-ink">
          <input
            checked={form.booking_requires_owner_confirmation}
            onChange={(event) => setField("booking_requires_owner_confirmation", event.target.checked)}
            type="checkbox"
          />
          New appointments require owner confirmation
        </label>

        <div className="rounded-lg border border-ink/10 bg-white p-4">
          <h2 className="font-black text-ink">Booking rules</h2>
          <p className="mt-1 text-sm leading-6 text-ink/60">Control currency, timezone, deposits, cancellation policy, and how far clients can book.</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label>
              <span className="label">Currency</span>
              <select className="input focus-ring" value={form.currency} onChange={(event) => setField("currency", event.target.value)}>
                {currencyOptions.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="label">Timezone</span>
              <select className="input focus-ring" value={form.timezone} onChange={(event) => setField("timezone", event.target.value)}>
                {timezoneOptions.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="label">Booking notice hours</span>
              <input className="input focus-ring" min={0} type="number" value={form.booking_notice_hours} onChange={(event) => setField("booking_notice_hours", Number(event.target.value))} />
            </label>
            <label>
              <span className="label">Maximum days in advance</span>
              <input className="input focus-ring" min={1} max={730} type="number" value={form.max_advance_booking_days} onChange={(event) => setField("max_advance_booking_days", Number(event.target.value))} />
            </label>
            <label>
              <span className="label">Cleanup / break minutes after appointment</span>
              <input className="input focus-ring" min={0} max={720} type="number" value={form.default_buffer_after_minutes} onChange={(event) => setField("default_buffer_after_minutes", Number(event.target.value))} />
              <span className="mt-2 block text-xs font-bold leading-5 text-ink/50">
                Hidden from clients. BookNest blocks this time after each appointment so the next client does not arrive too soon.
              </span>
            </label>
            <label className="flex items-center gap-3 rounded-lg border border-ink/10 bg-slate-50 p-4 font-bold text-ink">
              <input
                checked={form.default_deposit_required}
                onChange={(event) => setField("default_deposit_required", event.target.checked)}
                type="checkbox"
              />
              Require deposit by default for new services
            </label>
            <label>
              <span className="label">Default deposit amount</span>
              <input className="input focus-ring" min={0} type="number" value={form.default_deposit_amount} onChange={(event) => setField("default_deposit_amount", event.target.value)} />
            </label>
            <label className="md:col-span-2">
              <span className="label">Cancellation policy</span>
              <textarea
                className="input focus-ring min-h-24"
                placeholder="Example: Please cancel or reschedule at least 24 hours before your appointment."
                value={form.cancellation_policy}
                onChange={(event) => setField("cancellation_policy", event.target.value)}
              />
            </label>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Saving..." : "Save settings"}
          </button>
          {business ? (
            <label className="btn btn-secondary">
              <Upload className="h-4 w-4" /> Upload logo
              <input className="sr-only" accept="image/png,image/jpeg,image/webp" onChange={(event) => uploadLogo(event.target.files?.[0] ?? null)} type="file" />
            </label>
          ) : null}
        </div>
      </form>
      {form.logo_url ? (
        <div className="mt-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="Business logo preview" className="h-24 w-24 rounded-lg object-cover" src={form.logo_url} />
        </div>
      ) : null}
      {message ? <p className="mt-4 rounded-lg bg-blush/70 p-3 text-sm font-bold text-ink">{message}</p> : null}

      {business ? (
        <section className="mt-6 rounded-lg border border-ink/10 bg-mist p-4">
          <h2 className="font-black text-ink">Transfer owner login</h2>
          <p className="mt-2 text-sm leading-6 text-ink/65">
            Use this when you set up BookNest for someone else. It changes the login email for this business owner account and sends the new owner a password reset email.
          </p>
          <form className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]" onSubmit={transferOwnerLogin}>
            <label>
              <span className="label">New owner's email</span>
              <input className="input focus-ring" type="email" value={handoffEmail} onChange={(event) => setHandoffEmail(event.target.value)} required />
            </label>
            <button className="btn btn-primary self-end" disabled={busy}>
              <Mail className="h-4 w-4" /> Start handoff
            </button>
          </form>
          <div className="mt-4 rounded-lg border border-ink/10 bg-white p-3 text-sm leading-6 text-ink/70">
            <p className="font-black text-ink">Send them this login link:</p>
            <p className="break-all">{typeof window === "undefined" ? "https://your-domain.com/login" : `${window.location.origin}/login`}</p>
            <p className="mt-2 font-black text-ink">Password reset link:</p>
            <p className="break-all">{typeof window === "undefined" ? "https://your-domain.com/forgot-password" : `${window.location.origin}/forgot-password`}</p>
          </div>
          {handoffMessage ? <p className="mt-4 rounded-lg bg-blush/70 p-3 text-sm font-bold text-ink">{handoffMessage}</p> : null}
        </section>
      ) : null}
    </div>
  );
}
