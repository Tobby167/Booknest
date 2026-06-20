"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, CalendarPlus, Copy, ExternalLink } from "lucide-react";
import { BookNestLoader } from "@/components/BookNestLoader";
import { dateLabel, timeLabel, currency } from "@/lib/format";
import type { Appointment, Business } from "@/lib/types";
import { buildEmailTemplate } from "@/services/notifications/manualEmailTemplateService";
import { buildManualMessage, buildWhatsAppLink } from "@/services/notifications/manualWhatsAppService";

type AppointmentRow = Appointment & {
  services?: { name: string } | null;
  service_options?: { name: string } | null;
  payments?: { id: string; receipt_image_url: string | null; status: string }[];
};

function compactCalendarDate(date: string, time: string) {
  const [hours = "00", minutes = "00", seconds = "00"] = time.split(":");
  return `${date.replaceAll("-", "")}T${hours.padStart(2, "0")}${minutes.padStart(2, "0")}${seconds.padStart(2, "0")}`;
}

function statusClass(value: string) {
  if (value === "confirmed" || value === "completed") return "bg-emerald-50 text-emerald-600";
  if (value === "pending" || value === "pending_confirmation" || value === "receipt_uploaded") return "bg-amber-50 text-amber-600";
  if (value === "cancelled" || value === "no_show" || value === "rejected") return "bg-rose-50 text-rose-600";
  return "bg-slate-100 text-slate-600";
}

function shortStatus(value: string) {
  return value.replaceAll("_", " ");
}

export function AppointmentsPanel() {
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [business, setBusiness] = useState<Business | null>(null);
  const [status, setStatus] = useState("");
  const [date, setDate] = useState("");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [appointmentsResponse, settingsResponse] = await Promise.all([fetch("/api/appointments"), fetch("/api/business/settings")]);
    const appointmentsPayload = await appointmentsResponse.json();
    const settingsPayload = await settingsResponse.json();
    setAppointments(appointmentsPayload.appointments ?? []);
    setBusiness(settingsPayload.business ?? null);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    return appointments.filter((appointment) => {
      const searchText = `${appointment.client_name} ${appointment.client_email ?? ""} ${appointment.client_phone ?? ""}`.toLowerCase();
      return (!status || appointment.status === status) && (!date || appointment.appointment_date === date) && searchText.includes(search.toLowerCase());
    });
  }, [appointments, date, search, status]);

  async function updateStatus(id: string, nextStatus: string) {
    const response = await fetch(`/api/appointments/${id}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus })
    });
    const payload = await response.json();
    setMessage(response.ok ? "Appointment updated." : payload.error || "Could not update appointment.");
    if (response.ok) await load();
  }

  async function updatePayment(paymentId: string, action: "confirm" | "reject") {
    const response = await fetch(`/api/payments/${paymentId}/${action}`, { method: "PUT" });
    const payload = await response.json();
    setMessage(response.ok ? `Payment ${action}ed.` : payload.error || "Could not update payment.");
    if (response.ok) await load();
  }

  async function copyTemplate(appointment: AppointmentRow, type: "confirmation" | "reminder" | "payment_receipt_confirmation" | "payment_rejection" | "cancellation") {
    if (!business) return;
    const template = buildEmailTemplate(type, {
      business,
      appointment,
      serviceName: appointment.services?.name,
      optionName: appointment.service_options?.name
    });
    await navigator.clipboard.writeText(`${template.subject}\n\n${template.body}`);
    setMessage("Message copied.");
  }

  function whatsAppHref(appointment: AppointmentRow) {
    if (!business) return "#";
    const text = buildManualMessage("appointment_confirmed", {
      business,
      appointment,
      serviceName: appointment.services?.name,
      optionName: appointment.service_options?.name
    });
    return buildWhatsAppLink(appointment.client_phone, text);
  }

  function calendarTitle(appointment: AppointmentRow) {
    if (!business) return "BookNest appointment";
    return `${business.name}: ${appointment.services?.name ?? "Appointment"}${appointment.service_options?.name ? ` - ${appointment.service_options.name}` : ""}`;
  }

  function calendarDescription(appointment: AppointmentRow) {
    if (!business) return "";
    return [
      `${business.name} appointment`,
      `Client: ${appointment.client_name}`,
      `Service: ${appointment.services?.name ?? "Service"}${appointment.service_options?.name ? ` - ${appointment.service_options.name}` : ""}`,
      `Date: ${dateLabel(appointment.appointment_date)}`,
      `Time: ${timeLabel(appointment.start_time)} - ${timeLabel(appointment.end_time)}`,
      `Price: ${currency(appointment.total_price)}`,
      `Status: ${appointment.status.replaceAll("_", " ")}`,
      `Payment: ${appointment.payment_status.replaceAll("_", " ")}`,
      appointment.client_phone ? `Client phone: ${appointment.client_phone}` : null,
      appointment.client_email ? `Client email: ${appointment.client_email}` : null,
      appointment.notes ? `Notes: ${appointment.notes}` : null
    ]
      .filter(Boolean)
      .join("\n");
  }

  function googleCalendarHref(appointment: AppointmentRow) {
    if (!business) return "#";
    const params = new URLSearchParams({
      action: "TEMPLATE",
      text: calendarTitle(appointment),
      dates: `${compactCalendarDate(appointment.appointment_date, appointment.start_time)}/${compactCalendarDate(appointment.appointment_date, appointment.end_time)}`,
      details: calendarDescription(appointment),
      location: business.address || business.name
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  }

  function downloadCalendarFile(appointment: AppointmentRow) {
    if (!business) return;
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//BookNest//Owner Appointment//EN",
      "BEGIN:VEVENT",
      `UID:${appointment.id}@booknest.local`,
      `DTSTAMP:${compactCalendarDate(new Date().toISOString().slice(0, 10), new Date().toISOString().slice(11, 19))}`,
      `DTSTART:${compactCalendarDate(appointment.appointment_date, appointment.start_time)}`,
      `DTEND:${compactCalendarDate(appointment.appointment_date, appointment.end_time)}`,
      `SUMMARY:${calendarTitle(appointment).replaceAll("\n", " ")}`,
      `DESCRIPTION:${calendarDescription(appointment).replaceAll("\n", "\\n")}`,
      `LOCATION:${(business.address || business.name).replaceAll("\n", " ")}`,
      "END:VEVENT",
      "END:VCALENDAR"
    ].join("\r\n");
    const blob = new Blob([lines], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "booknest-owner-appointment.ics";
    link.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <BookNestLoader label="Loading appointments" />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-ink">Appointments</h1>
          <p className="mt-1 text-sm text-ink/60">Manage and track all appointments.</p>
        </div>
        <a className="btn btn-primary" href={business ? `/book/${business.slug}` : "/dashboard/settings"} target="_blank">
          + New Appointment
        </a>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[1fr_190px_190px_auto]">
        <input className="input focus-ring" placeholder="Search client, phone, email" value={search} onChange={(event) => setSearch(event.target.value)} />
        <input className="input focus-ring" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        <select className="input focus-ring" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">All statuses</option>
          {["pending", "pending_confirmation", "confirmed", "cancelled", "rescheduled", "completed", "no_show"].map((item) => (
            <option key={item} value={item}>
              {item.replaceAll("_", " ")}
            </option>
          ))}
        </select>
          <button className="btn btn-secondary" onClick={() => setMessage("Use the status buttons inside each row to update appointments.")} type="button">
            Filter
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="responsive-table overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-black text-slate-500">
              <tr>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Service</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3">Receipt</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((appointment) => {
                const payment = appointment.payments?.[0];
                return (
                  <tr className="align-top hover:bg-slate-50/70" key={appointment.id}>
                    <td className="px-4 py-4 font-bold text-ink" data-label="Time">
                      {dateLabel(appointment.appointment_date)}
                      <span className="mt-1 block text-xs font-semibold text-slate-400">{timeLabel(appointment.start_time)}</span>
                    </td>
                    <td className="px-4 py-4" data-label="Client">
                      <p className="font-black text-ink">{appointment.client_name}</p>
                      <p className="text-xs text-slate-500">{appointment.client_phone || appointment.client_email || "No contact"}</p>
                    </td>
                    <td className="px-4 py-4" data-label="Service">
                      <p className="font-bold text-ink">{appointment.services?.name ?? "Service"}</p>
                      <p className="text-xs text-slate-500">
                        {appointment.service_options?.name ? `${appointment.service_options.name} | ` : ""}
                        {currency(appointment.total_price)}
                      </p>
                    </td>
                    <td className="px-4 py-4" data-label="Status">
                      <span className={`rounded-full px-3 py-1 text-xs font-black capitalize ${statusClass(appointment.status)}`}>{shortStatus(appointment.status)}</span>
                    </td>
                    <td className="px-4 py-4" data-label="Payment">
                      <span className={`rounded-full px-3 py-1 text-xs font-black capitalize ${statusClass(appointment.payment_status)}`}>
                        {shortStatus(appointment.payment_status)}
                      </span>
                    </td>
                    <td className="px-4 py-4" data-label="Receipt">
                      {payment?.receipt_image_url ? (
                        <a className="inline-flex items-center gap-1 text-xs font-black text-purple-600" href={payment.receipt_image_url} rel="noreferrer" target="_blank">
                          <ExternalLink className="h-3.5 w-3.5" /> View
                        </a>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-4" data-label="Actions">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-black hover:border-purple-300" onClick={() => updateStatus(appointment.id, "confirmed")}>
                          Confirm
                        </button>
                        <button className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-black hover:border-purple-300" onClick={() => updateStatus(appointment.id, "completed")}>
                          Complete
                        </button>
                        <button className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-black hover:border-rose-300" onClick={() => updateStatus(appointment.id, "cancelled")}>
                          Cancel
                        </button>
                        {payment ? (
                          <>
                            <button className="rounded-lg bg-purple-600 px-3 py-2 text-xs font-black text-white" onClick={() => updatePayment(payment.id, "confirm")}>
                              Paid
                            </button>
                            <button className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-black text-white" onClick={() => updatePayment(payment.id, "reject")}>
                              Reject
                            </button>
                          </>
                        ) : null}
                        <a className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-black hover:border-purple-300" href={whatsAppHref(appointment)} rel="noreferrer" target="_blank">
                          WhatsApp
                        </a>
                        <a className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-black hover:border-purple-300" href={googleCalendarHref(appointment)} rel="noreferrer" target="_blank">
                          <CalendarPlus className="inline h-3.5 w-3.5" /> Calendar
                        </a>
                        <button className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-black hover:border-purple-300" onClick={() => downloadCalendarFile(appointment)}>
                          <CalendarDays className="inline h-3.5 w-3.5" /> ICS
                        </button>
                        <button className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-black hover:border-purple-300" onClick={() => copyTemplate(appointment, "reminder")}>
                          <Copy className="inline h-3.5 w-3.5" /> Reminder
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs font-bold text-slate-500">
          <span>
            Showing {filtered.length} of {appointments.length} appointments
          </span>
          <span>Page 1</span>
        </div>
      </div>

      {filtered.length === 0 ? <p className="rounded-xl border border-slate-200 bg-white p-5 text-center font-bold text-ink/60">No appointments found.</p> : null}
      {message ? <p className="rounded-lg bg-purple-50 p-3 text-sm font-bold text-purple-700">{message}</p> : null}
    </div>
  );
}
