"use client";

import Link from "next/link";
import { CheckCircle2, Circle, Code, CreditCard, ExternalLink, Image, Link2, Scissors, Settings, Share2, Timer } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { BookNestLoader } from "@/components/BookNestLoader";
import type { Availability, Business, Service } from "@/lib/types";

type CatalogResponse = {
  business: Business | null;
  services: Service[];
};

type AvailabilityResponse = {
  availability: Availability[];
};

type PaymentConfigResponse = {
  stripeEnabled: boolean;
  reason?: string | null;
};

function origin() {
  if (typeof window === "undefined") return "";
  return window.location.origin;
}

export function OnboardingPanel() {
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfigResponse | null>(null);
  const [copied, setCopied] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [catalogResponse, availabilityResponse, paymentResponse] = await Promise.all([
        fetch("/api/dashboard/catalog").then((response) => response.json()),
        fetch("/api/dashboard/availability").then((response) => response.json()),
        fetch("/api/payments/config").then((response) => response.json())
      ]);

      setCatalog(catalogResponse);
      setAvailability((availabilityResponse as AvailabilityResponse).availability ?? []);
      setPaymentConfig(paymentResponse);
      setLoading(false);
    }

    load();
  }, []);

  const business = catalog?.business ?? null;
  const bookingUrl = business ? `${origin()}/book/${business.slug}` : "";
  const embedUrl = business ? `${origin()}/embed/${business.slug}` : "";
  const embedCode = business
    ? `<iframe src="${embedUrl}" width="100%" height="800" style="border: none; border-radius: 12px;"></iframe>`
    : "";

  const steps = useMemo(
    () => [
      {
        title: "Business profile",
        body: "Add the business name, slug, contact details, and public booking description.",
        done: Boolean(business?.name && business?.slug && (business.phone || business.email)),
        href: "/dashboard/settings",
        action: business ? "Edit profile" : "Create profile",
        icon: Settings
      },
      {
        title: "Business logo",
        body: "Upload the owner logo so booking links and embeds feel branded.",
        done: Boolean(business?.logo_url),
        href: "/dashboard/settings",
        action: "Upload logo",
        icon: Image
      },
      {
        title: "Services",
        body: "Create categories, services, options, add-ons, prices, deposits, and durations.",
        done: Boolean(catalog?.services?.length),
        href: "/dashboard/services",
        action: "Manage services",
        icon: Scissors
      },
      {
        title: "Availability",
        body: "Set working days, hours, and blocked dates so clients only see valid times.",
        done: availability.some((row) => row.is_available),
        href: "/dashboard/availability",
        action: "Set availability",
        icon: Timer
      },
      {
        title: "Payment settings",
        body: paymentConfig?.stripeEnabled
          ? "Stripe is ready. Manual payment can still stay available as backup."
          : "Manual payment is available now. Add Stripe keys later to turn on online checkout.",
        done: Boolean(
          business?.bank_name ||
            business?.bank_account_name ||
            business?.bank_account_number ||
            paymentConfig?.stripeEnabled
        ),
        href: "/dashboard/settings",
        action: "Review payments",
        icon: CreditCard
      },
      {
        title: "Booking link and embed",
        body: "Copy the direct booking link or iframe code for another website.",
        done: Boolean(business?.slug),
        href: "/dashboard/embed-code",
        action: "Get links",
        icon: Code
      }
    ],
    [availability, business, catalog?.services?.length, paymentConfig?.stripeEnabled]
  );

  async function copy(value: string, label: string) {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopied(label);
    window.setTimeout(() => setCopied(""), 1600);
  }

  if (loading) return <BookNestLoader label="Loading setup guide" />;

  const completed = steps.filter((step) => step.done).length;

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-purple-600">Owner onboarding</p>
            <h1 className="mt-2 text-2xl font-black text-ink sm:text-3xl">Set up this booking site</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/60">
              Follow these steps when creating BookNest for a business owner. When everything is ready, transfer the login to the owner.
            </p>
          </div>
          <div className="rounded-2xl bg-purple-50 px-5 py-4 text-center">
            <p className="text-3xl font-black text-purple-600">{completed}/{steps.length}</p>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-ink/45">Complete</p>
          </div>
        </div>
      </section>

      {/* AI SETUP WIDGET REMOVED */}

      <section className="grid gap-4 lg:grid-cols-2">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" key={step.title}>
              <div className="flex items-start gap-4">
                <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${step.done ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"}`}>
                  {step.done ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="font-black text-ink">{step.title}</h2>
                    {step.done ? <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-black text-emerald-600">Done</span> : null}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-ink/60">{step.body}</p>
                  <Link className="btn btn-secondary mt-4" href={step.href}>
                    {step.action}
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-ink">Owner handoff</h2>
            <p className="mt-2 text-sm leading-6 text-ink/60">
              After setup, use the transfer page to change the login email and send the new owner a password reset link.
            </p>
          </div>
          <Link className="btn btn-primary" href="/dashboard/transfer-owner">
            Transfer owner
          </Link>
        </div>
      </section>

      {business ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-purple-600" />
            <h2 className="text-xl font-black text-ink">Share when ready</h2>
          </div>
          <div className="mt-4 grid gap-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-ink/45">Direct booking link</p>
              <p className="mt-2 break-all text-sm font-bold text-ink">{bookingUrl}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button className="btn btn-secondary" onClick={() => copy(bookingUrl, "booking")}>
                  <Link2 className="h-4 w-4" /> Copy link
                </button>
                <a className="btn btn-secondary" href={bookingUrl} rel="noreferrer" target="_blank">
                  <ExternalLink className="h-4 w-4" /> Open
                </a>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-ink/45">Iframe embed code</p>
              <pre className="mt-2 overflow-x-auto rounded-lg bg-white p-3 text-xs font-bold text-ink">{embedCode}</pre>
              <button className="btn btn-secondary mt-3" onClick={() => copy(embedCode, "embed")}>
                <Code className="h-4 w-4" /> Copy embed code
              </button>
            </div>
          </div>
          {copied ? <p className="mt-3 text-sm font-black text-emerald-600">{copied === "booking" ? "Booking link copied." : "Embed code copied."}</p> : null}
        </section>
      ) : (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <Circle className="h-5 w-5 text-slate-400" />
            <p className="font-black text-ink">Create a business profile first to generate booking links.</p>
          </div>
        </section>
      )}
    </div>
  );
}
