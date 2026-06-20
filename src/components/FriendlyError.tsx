"use client";

import Link from "next/link";
import { AlertTriangle, Home, LayoutDashboard, RefreshCw } from "lucide-react";

type FriendlyErrorProps = {
  title?: string;
  message?: string;
  reset?: () => void;
  primaryHref?: string;
  primaryLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  compact?: boolean;
};

export function FriendlyError({
  title = "Something needs attention",
  message = "This page could not load safely. Please refresh and try again.",
  reset,
  primaryHref = "/",
  primaryLabel = "Go home",
  secondaryHref = "/dashboard",
  secondaryLabel = "Open dashboard",
  compact = false
}: FriendlyErrorProps) {
  return (
    <main className="min-h-screen bg-[#f7f8fb] px-4 py-10 text-slate-950">
      <section
        className={`mx-auto rounded-[24px] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)] ${
          compact ? "max-w-xl p-6" : "max-w-3xl p-8 sm:p-10"
        }`}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50 text-violet-700">
          <AlertTriangle className="h-7 w-7" aria-hidden="true" />
        </div>

        <div className="mt-7 space-y-3">
          <p className="text-xs font-black uppercase tracking-[0.32em] text-violet-600">BookNest notice</p>
          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">{title}</h1>
          <p className="max-w-2xl text-base leading-7 text-slate-600">{message}</p>
          <p className="max-w-2xl text-sm leading-6 text-slate-500">
            Your private booking data and setup details are protected. Try again, or contact support if this keeps happening.
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          {reset ? (
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-violet-700 px-5 py-3 text-sm font-black text-white shadow-lg shadow-violet-200 transition hover:bg-violet-800"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Try again
            </button>
          ) : null}
          <Link
            href={primaryHref}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-900 transition hover:border-violet-200 hover:bg-violet-50"
          >
            <Home className="h-4 w-4" aria-hidden="true" />
            {primaryLabel}
          </Link>
          <Link
            href={secondaryHref}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-900 transition hover:border-violet-200 hover:bg-violet-50"
          >
            <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
            {secondaryLabel}
          </Link>
        </div>
      </section>
    </main>
  );
}
