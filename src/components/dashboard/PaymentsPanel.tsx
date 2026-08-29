"use client";

import { CheckCircle2, ExternalLink, Eye, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { BookNestLoader } from "@/components/BookNestLoader";
import { currency, dateLabel, timeLabel } from "@/lib/format";

type PaymentRow = {
  id: string;
  amount: number | null;
  status: string;
  receipt_image_url: string | null;
  created_at: string;
  ai_status?: string | null;
  ai_report?: any | null;
  appointments?: {
    client_name: string;
    client_email: string | null;
    client_phone: string | null;
    appointment_date: string;
    start_time: string;
    end_time: string;
    status: string;
    payment_status: string;
    total_price: number | null;
    notes: string | null;
    services?: { name: string | null } | null;
    service_options?: { name: string | null } | null;
  } | null;
};

export function PaymentsPanel() {
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [date, setDate] = useState("");
  const [selectedPayment, setSelectedPayment] = useState<PaymentRow | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [isRechecking, setIsRechecking] = useState<string | null>(null);

  async function runAiCheck(id: string) {
    setIsRechecking(id);
    setPayments(prev => prev.map(p => p.id === id ? { ...p, ai_status: "checking" } : p));
    if (selectedPayment?.id === id) {
      setSelectedPayment(prev => prev ? { ...prev, ai_status: "checking", ai_report: null } : null);
    }

    try {
      const res = await fetch(`/api/payments/${id}/verify-ai`, {
        method: "POST"
      });
      const data = await res.json();
      if (res.ok) {
        setPayments(prev => prev.map(p => p.id === id ? { ...p, ai_status: data.ai_status, ai_report: data.ai_report } : p));
        if (selectedPayment?.id === id) {
          setSelectedPayment(prev => prev ? { ...prev, ai_status: data.ai_status, ai_report: data.ai_report } : null);
        }
        setMessage("AI receipt audit completed.");
      } else {
        setMessage(data.error || "AI check failed.");
        load();
      }
    } catch (err) {
      console.error("AI check error:", err);
      setMessage("Network error running AI check.");
      load();
    } finally {
      setIsRechecking(null);
    }
  }

  async function load() {
    setLoading(true);
    const response = await fetch("/api/dashboard/payments");
    const data = await response.json();
    setPayments(data.payments ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function updatePayment(id: string, action: "confirm" | "reject", reason = "") {
    const response = await fetch(`/api/payments/${id}/${action}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: action === "reject" ? JSON.stringify({ reason }) : undefined
    });
    const data = await response.json();
    setMessage(response.ok ? `Payment ${action}ed.` : data.error || "Could not update payment.");
    if (response.ok) {
      setSelectedPayment(null);
      setRejectReason("");
      await load();
    }
  }

  const filtered = useMemo(() => {
    return payments.filter((payment) => {
      const text = `${payment.appointments?.client_name ?? ""} ${payment.appointments?.client_phone ?? ""}`.toLowerCase();
      const paymentDate = payment.appointments?.appointment_date ?? payment.created_at.slice(0, 10);
      return text.includes(search.toLowerCase()) && (!status || payment.status === status) && (!date || paymentDate === date);
    });
  }, [date, payments, search, status]);

  if (loading) return <BookNestLoader label="Loading payments" />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black text-ink">Payments</h1>
        <p className="mt-1 text-sm text-ink/60">Track payments and receipt uploads.</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[1fr_190px_220px]">
          <input className="input focus-ring" placeholder="Search client, appointment..." value={search} onChange={(event) => setSearch(event.target.value)} />
          <input className="input focus-ring" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          <select className="input focus-ring" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All payment status</option>
            {["pending", "receipt_uploaded", "confirmed", "rejected"].map((item) => (
              <option key={item} value={item}>
                {item.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="responsive-table overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-black text-slate-500">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Payment Method</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Receipt</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((payment) => (
                <tr className="hover:bg-slate-50/70" key={payment.id}>
                  <td className="px-4 py-4 font-bold text-ink" data-label="Date">
                    {payment.appointments ? dateLabel(payment.appointments.appointment_date) : dateLabel(payment.created_at.slice(0, 10))}
                    {payment.appointments ? <span className="mt-1 block text-xs font-semibold text-slate-400">{timeLabel(payment.appointments.start_time)}</span> : null}
                  </td>
                  <td className="px-4 py-4" data-label="Client">
                    <p className="font-black text-ink">{payment.appointments?.client_name ?? "Client"}</p>
                    <p className="text-xs text-slate-500">{payment.appointments?.client_phone ?? "No phone"}</p>
                  </td>
                  <td className="px-4 py-4 font-black text-ink" data-label="Amount">{currency(payment.amount)}</td>
                  <td className="px-4 py-4 text-slate-600" data-label="Method">Bank Transfer</td>
                  <td className="px-4 py-4" data-label="Status">
                    <div className="flex flex-col gap-1.5 items-start">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-black capitalize ${
                          payment.status === "confirmed"
                            ? "bg-emerald-50 text-emerald-600"
                            : payment.status === "rejected"
                              ? "bg-rose-50 text-rose-600"
                              : "bg-amber-50 text-amber-600"
                        }`}
                      >
                        {payment.status.replaceAll("_", " ")}
                      </span>
                      {payment.receipt_image_url && payment.ai_status && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${
                            payment.ai_status === "verified"
                              ? "bg-emerald-100 text-emerald-800"
                              : payment.ai_status === "flagged"
                                ? "bg-rose-100 text-rose-800 animate-pulse"
                                : payment.ai_status === "checking"
                                  ? "bg-amber-100 text-amber-800 animate-pulse"
                                  : payment.ai_status === "failed"
                                    ? "bg-slate-100 text-slate-700"
                                    : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          🤖 AI {payment.ai_status}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4" data-label="Receipt">
                    {payment.receipt_image_url ? (
                      <button className="inline-flex items-center gap-1 text-xs font-black text-purple-600" onClick={() => setSelectedPayment(payment)}>
                        <Eye className="h-3.5 w-3.5" /> Review
                      </button>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-4" data-label="Actions">
                    <div className="flex justify-end gap-2">
                      <button className="rounded-lg bg-purple-600 px-3 py-2 text-xs font-black text-white" onClick={() => updatePayment(payment.id, "confirm")}>
                        Confirm
                      </button>
                      <button className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-black text-rose-600" onClick={() => setSelectedPayment(payment)}>
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs font-bold text-slate-500">
          <span>
            Showing {filtered.length} of {payments.length} payments
          </span>
          <span>Page 1</span>
        </div>
      </div>

      <aside className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm xl:sticky xl:top-5 xl:self-start">
        {selectedPayment ? (
          <div>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-ink">Receipt review</h2>
                <p className="mt-1 text-sm text-ink/55">Check the receipt against the appointment before confirming.</p>
              </div>
              <button className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-black text-ink/60" onClick={() => setSelectedPayment(null)}>
                Close
              </button>
            </div>

            <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
              {selectedPayment.receipt_image_url ? (
                <a href={selectedPayment.receipt_image_url} rel="noreferrer" target="_blank">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt="Uploaded payment receipt" className="max-h-[420px] w-full object-contain" src={selectedPayment.receipt_image_url} />
                </a>
              ) : (
                <div className="grid h-52 place-items-center text-sm font-bold text-ink/45">No receipt uploaded.</div>
              )}
            </div>

            {selectedPayment.receipt_image_url ? (
              <a className="mt-3 inline-flex items-center gap-1 text-xs font-black text-purple-600" href={selectedPayment.receipt_image_url} rel="noreferrer" target="_blank">
                <ExternalLink className="h-3.5 w-3.5" /> Open full receipt
              </a>
            ) : null}

            {/* AI Receipt Audit Section */}
            {selectedPayment.receipt_image_url && (
              <div className="mt-4 rounded-xl border border-purple-200 bg-purple-50/20 p-4 text-sm">
                <div className="flex items-center justify-between">
                  <h4 className="font-black text-purple-900 flex items-center gap-1">
                    🤖 AI Audit Report
                  </h4>
                  <span
                    className={`rounded px-2 py-0.5 text-[9px] font-black uppercase ${
                      selectedPayment.ai_status === "verified"
                        ? "bg-emerald-100 text-emerald-800"
                        : selectedPayment.ai_status === "flagged"
                          ? "bg-rose-100 text-rose-800"
                          : selectedPayment.ai_status === "checking"
                            ? "bg-amber-100 text-amber-800 animate-pulse"
                            : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {selectedPayment.ai_status || "Unchecked"}
                  </span>
                </div>

                {selectedPayment.ai_status === "checking" && (
                  <p className="mt-2 text-xs text-purple-700 animate-pulse font-semibold">
                    Qwen Vision model is currently auditing this receipt...
                  </p>
                )}

                {selectedPayment.ai_report?.extracted && (
                  <div className="mt-3 space-y-2 text-xs border-t border-purple-100/50 pt-3">
                    <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-purple-950/80">
                      <div><strong>Extracted Amount:</strong></div>
                      <div className="font-bold">
                        {selectedPayment.ai_report.extracted.amount 
                          ? currency(selectedPayment.ai_report.extracted.amount) 
                          : "Not found"}
                      </div>
                      
                      <div><strong>Transaction Ref:</strong></div>
                      <div className="font-bold truncate" title={selectedPayment.ai_report.extracted.transactionRef}>
                        {selectedPayment.ai_report.extracted.transactionRef || "Not found"}
                      </div>

                      <div><strong>Recipient Info:</strong></div>
                      <div className="truncate" title={selectedPayment.ai_report.extracted.recipient}>
                        {selectedPayment.ai_report.extracted.recipient || "Not found"}
                      </div>

                      <div><strong>Sender/Bank:</strong></div>
                      <div className="truncate">
                        {[selectedPayment.ai_report.extracted.sender, selectedPayment.ai_report.extracted.bank].filter(Boolean).join(" / ") || "Not found"}
                      </div>
                    </div>

                    <div className="mt-3 space-y-1.5 border-t border-purple-100/30 pt-2">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold">
                        {selectedPayment.ai_report.checks?.amountMatches ? (
                          <span className="text-emerald-600">✅ Amount Matches</span>
                        ) : (
                          <span className="text-rose-600 font-extrabold">❌ Amount Mismatch (Expected {currency(selectedPayment.amount)})</span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 text-[11px] font-bold">
                        {selectedPayment.ai_report.checks?.referenceIsUnique ? (
                          <span className="text-emerald-600">✅ Unique Reference</span>
                        ) : (
                          <span className="text-rose-600 font-extrabold">❌ Duplicate Reference Found</span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 text-[11px] font-bold">
                        {selectedPayment.ai_report.checks?.recipientMatches ? (
                          <span className="text-emerald-600">✅ Recipient Matches Settings</span>
                        ) : (
                          <span className="text-rose-600 font-extrabold">❌ Recipient Mismatch</span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 text-[11px] font-bold">
                        {selectedPayment.ai_report.checks?.noTampering ? (
                          <span className="text-emerald-600">✅ No Tampering Detected</span>
                        ) : (
                          <span className="text-rose-600 font-extrabold">❌ Suspected Tampering</span>
                        )}
                      </div>
                    </div>

                    {selectedPayment.ai_report.extracted.notes && (
                      <p className="mt-2 bg-purple-100/30 p-2 rounded text-[11px] text-purple-900 leading-normal">
                        <strong>AI Notes:</strong> {selectedPayment.ai_report.extracted.notes}
                      </p>
                    )}
                  </div>
                )}

                {selectedPayment.ai_status === "failed" && selectedPayment.ai_report?.error && (
                  <div className="mt-2 text-xs text-rose-700 bg-rose-50 p-2 rounded border border-rose-100">
                    <strong>Error:</strong> {selectedPayment.ai_report.error}
                  </div>
                )}

                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    disabled={isRechecking === selectedPayment.id}
                    onClick={() => runAiCheck(selectedPayment.id)}
                    className="text-[10px] font-bold uppercase text-purple-700 hover:text-purple-900 flex items-center gap-1 disabled:opacity-50"
                  >
                    {isRechecking === selectedPayment.id ? "Auditing..." : "🔄 Run AI Check"}
                  </button>
                </div>
              </div>
            )}

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-ink/45">Expected amount</p>
              <p className="mt-1 text-2xl font-black text-ink">{currency(selectedPayment.amount)}</p>
              <div className="mt-4 grid gap-2 text-ink/70">
                <p><strong>Client:</strong> {selectedPayment.appointments?.client_name ?? "Client"}</p>
                <p><strong>Phone:</strong> {selectedPayment.appointments?.client_phone ?? "No phone"}</p>
                <p><strong>Email:</strong> {selectedPayment.appointments?.client_email ?? "No email"}</p>
                <p>
                  <strong>Appointment:</strong>{" "}
                  {selectedPayment.appointments
                    ? `${dateLabel(selectedPayment.appointments.appointment_date)} at ${timeLabel(selectedPayment.appointments.start_time)}`
                    : "No appointment linked"}
                </p>
                <p>
                  <strong>Service:</strong>{" "}
                  {[selectedPayment.appointments?.services?.name, selectedPayment.appointments?.service_options?.name]
                    .filter(Boolean)
                    .join(" - ") || "No service"}
                </p>
                <p><strong>Status:</strong> {selectedPayment.status.replaceAll("_", " ")}</p>
                {selectedPayment.appointments?.notes ? <p><strong>Notes:</strong> {selectedPayment.appointments.notes}</p> : null}
              </div>
            </div>

            <label className="mt-4 block">
              <span className="label">Reject reason</span>
              <textarea
                className="input focus-ring min-h-24"
                placeholder="Example: receipt amount does not match, image is unclear, or transfer was not received."
                value={rejectReason}
                onChange={(event) => setRejectReason(event.target.value)}
              />
            </label>

            <div className="mt-4 flex flex-wrap gap-2">
              <button className="btn btn-primary" onClick={() => updatePayment(selectedPayment.id, "confirm")}>
                <CheckCircle2 className="h-4 w-4" /> Confirm payment
              </button>
              <button className="rounded-lg border border-rose-200 px-4 py-3 text-sm font-black text-rose-600" onClick={() => updatePayment(selectedPayment.id, "reject", rejectReason)}>
                <XCircle className="inline h-4 w-4" /> Reject receipt
              </button>
            </div>
          </div>
        ) : (
          <div className="grid min-h-80 place-items-center rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
            <div>
              <Eye className="mx-auto h-8 w-8 text-slate-400" />
              <h2 className="mt-3 font-black text-ink">Select a receipt</h2>
              <p className="mt-2 text-sm leading-6 text-ink/55">Use Review to inspect uploaded receipts, compare the amount, and approve or reject safely.</p>
            </div>
          </div>
        )}
      </aside>
      </div>

      {payments.length === 0 ? <p className="rounded-xl border border-slate-200 bg-white p-5 text-center font-bold text-ink/60">No payments yet.</p> : null}
      {message ? <p className="rounded-lg bg-purple-50 p-3 text-sm font-bold text-purple-700">{message}</p> : null}
    </div>
  );
}
