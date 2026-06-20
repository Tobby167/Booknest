"use client";

import { Copy, ExternalLink, Instagram, Mail, MessageCircle, QrCode } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BookNestLoader } from "@/components/BookNestLoader";
import type { Business } from "@/lib/types";

export function EmbedCodePanel() {
  const [business, setBusiness] = useState<Business | null>(null);
  const [origin, setOrigin] = useState("http://localhost:3000");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setOrigin(window.location.origin);
    fetch("/api/business/settings")
      .then((response) => response.json())
      .then((data) => setBusiness(data.business ?? null))
      .finally(() => setLoading(false));
  }, []);

  const code = useMemo(() => {
    if (!business) return "";
    return `<iframe
  src="${origin}/embed/${business.slug}"
  width="100%"
  height="800"
  style="border: none; border-radius: 12px;"
></iframe>`;
  }, [business, origin]);
  const publicUrl = business ? `${origin}/book/${business.slug}` : "";
  const qrUrl = publicUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=12&data=${encodeURIComponent(publicUrl)}`
    : "";
  const whatsappUrl = publicUrl
    ? `https://wa.me/?text=${encodeURIComponent(`Book an appointment here: ${publicUrl}`)}`
    : "#";
  const emailUrl = publicUrl
    ? `mailto:?subject=${encodeURIComponent(`${business?.name ?? "BookNest"} booking link`)}&body=${encodeURIComponent(`Book an appointment here:\n${publicUrl}`)}`
    : "#";

  async function copy(value: string, label: string) {
    await navigator.clipboard.writeText(value);
    setMessage(`${label} copied.`);
  }

  if (loading) return <BookNestLoader label="Loading dashboard" />;

  if (!business) {
    return (
      <div className="card p-6">
        <h1 className="text-2xl font-black text-ink">Create your business first</h1>
        <Link className="btn btn-primary mt-5" href="/dashboard/settings">
          Open settings
        </Link>
      </div>
    );
  }

  return (
    <div className="grid min-w-0 gap-5 xl:grid-cols-[420px_1fr]">
      <section className="card min-w-0 overflow-hidden p-4 sm:p-5">
        <h1 className="text-2xl font-black text-ink">Embed code</h1>
        <p className="mt-2 text-sm font-semibold text-slate-700">Share the booking link directly, use it in an Instagram bio, or paste the iframe into another website.</p>
        <div className="mt-5 min-w-0 rounded-xl border border-slate-300 bg-slate-50 p-4">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-600">Direct booking link</p>
          <p className="mt-2 min-w-0 break-all text-sm font-bold text-ink">{publicUrl}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="btn btn-secondary" onClick={() => copy(publicUrl, "Booking link")}>
              <Copy className="h-4 w-4" /> Copy link
            </button>
            <a className="btn btn-secondary" href={publicUrl} rel="noreferrer" target="_blank">
              <ExternalLink className="h-4 w-4" /> Open
            </a>
          </div>
        </div>
        <pre className="mt-5 max-w-full overflow-x-auto whitespace-pre-wrap break-all rounded-lg bg-ink p-4 text-sm text-white">{code}</pre>
        <button className="btn btn-primary mt-4" onClick={() => copy(code, "Embed code")}>
          <Copy className="h-4 w-4" /> Copy embed code
        </button>
        <div className="mt-5 min-w-0 rounded-xl border border-slate-300 bg-white p-4">
          <div className="flex items-center gap-2">
            <QrCode className="h-4 w-4 text-purple-600" />
            <h2 className="font-black text-ink">QR code</h2>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="Booking QR code" className="mt-4 h-44 w-44 max-w-full rounded-xl border border-slate-300 bg-white p-2" src={qrUrl} />
          <a className="btn btn-secondary mt-3" download={`${business.slug}-booking-qr.png`} href={qrUrl}>
            Download QR
          </a>
        </div>
        <div className="mt-5 min-w-0 rounded-xl border border-slate-300 bg-white p-4">
          <h2 className="font-black text-ink">Share buttons</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <a className="btn btn-secondary" href={whatsappUrl} rel="noreferrer" target="_blank">
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </a>
            <button className="btn btn-secondary" onClick={() => copy(publicUrl, "Instagram bio link")}>
              <Instagram className="h-4 w-4" /> Instagram bio
            </button>
            <a className="btn btn-secondary" href={emailUrl}>
              <Mail className="h-4 w-4" /> Email
            </a>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link className="btn btn-secondary" href={`/book/${business.slug}`}>Public page</Link>
          <Link className="btn btn-secondary" href={`/embed/${business.slug}`}>Embed page</Link>
        </div>
        {message ? <p className="mt-4 rounded-lg bg-blush/70 p-3 text-sm font-bold text-ink">{message}</p> : null}
      </section>
      <section className="card min-w-0 overflow-hidden p-3">
        <iframe className="h-[800px] w-full rounded-lg border-0 bg-white" src={`/embed/${business.slug}`} title="BookNest embed preview" />
      </section>
    </div>
  );
}
