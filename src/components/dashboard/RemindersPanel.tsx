"use client";

import { Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { BookNestLoader } from "@/components/BookNestLoader";
import { dateLabel, timeLabel } from "@/lib/format";
import type { Appointment, Business } from "@/lib/types";
import { buildManualMessage, buildWhatsAppLink, WhatsAppTemplateType } from "@/services/notifications/manualWhatsAppService";

type ReminderRow = Appointment & {
  services?: { name: string } | null;
  service_options?: { name: string } | null;
};

type ReminderData = {
  today: ReminderRow[];
  tomorrow: ReminderRow[];
  pending: ReminderRow[];
  followUp: ReminderRow[];
};

const sections: { key: keyof ReminderData; title: string; template: WhatsAppTemplateType }[] = [
  { key: "today", title: "Appointments today", template: "reminder_today" },
  { key: "tomorrow", title: "Appointments tomorrow", template: "reminder_24h" },
  { key: "pending", title: "Pending confirmations", template: "booking_received" },
  { key: "followUp", title: "Needs follow-up / receipts uploaded", template: "payment_receipt_received" }
];

export function RemindersPanel() {
  const [data, setData] = useState<ReminderData>({ today: [], tomorrow: [], pending: [], followUp: [] });
  const [business, setBusiness] = useState<Business | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [today, tomorrow, pending, followUp, settings] = await Promise.all([
        fetch("/api/reminders/today").then((response) => response.json()),
        fetch("/api/reminders/tomorrow").then((response) => response.json()),
        fetch("/api/reminders/pending-confirmations").then((response) => response.json()),
        fetch("/api/reminders/needs-follow-up").then((response) => response.json()),
        fetch("/api/business/settings").then((response) => response.json())
      ]);
      setData({
        today: today.appointments ?? [],
        tomorrow: tomorrow.appointments ?? [],
        pending: pending.appointments ?? [],
        followUp: followUp.appointments ?? []
      });
      setBusiness(settings.business ?? null);
      setLoading(false);
    }
    load();
  }, []);

  async function copyReminder(appointment: ReminderRow, template: WhatsAppTemplateType) {
    if (!business) return;
    const text = buildManualMessage(template, {
      business,
      appointment,
      serviceName: appointment.services?.name,
      optionName: appointment.service_options?.name
    });
    await navigator.clipboard.writeText(text);
    setMessage("Reminder copied.");
  }

  function whatsAppLink(appointment: ReminderRow, template: WhatsAppTemplateType) {
    if (!business) return "#";
    const text = buildManualMessage(template, {
      business,
      appointment,
      serviceName: appointment.services?.name,
      optionName: appointment.service_options?.name
    });
    return buildWhatsAppLink(appointment.client_phone, text);
  }

  if (loading) return <BookNestLoader label="Loading reminders" />;

  return (
    <div>
      <h1 className="text-2xl font-black text-ink">Reminders / follow-ups</h1>
      <p className="mt-2 text-sm text-ink/65">Use manual WhatsApp links and copyable messages until automated SMS/email providers are added later.</p>
      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        {sections.map((section) => (
          <section className="card p-4" key={section.key}>
            <h2 className="font-black text-ink">{section.title}</h2>
            <div className="mt-4 grid gap-3">
              {data[section.key].map((appointment) => (
                <article className="rounded-lg border border-ink/10 bg-white p-3" key={appointment.id}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="font-black text-ink">{appointment.client_name}</h3>
                      <p className="mt-1 text-sm text-ink/65">
                        {appointment.services?.name ?? "Service"} | {dateLabel(appointment.appointment_date)} at {timeLabel(appointment.start_time)}
                      </p>
                      <p className="mt-1 text-xs font-black uppercase tracking-[0.12em] text-ink/45">
                        {appointment.status.replaceAll("_", " ")} | {appointment.payment_status.replaceAll("_", " ")}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <a className="btn btn-secondary" href={whatsAppLink(appointment, section.template)} rel="noreferrer" target="_blank">
                        WhatsApp
                      </a>
                      <button className="btn btn-secondary" onClick={() => copyReminder(appointment, section.template)}>
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
              {data[section.key].length === 0 ? <p className="rounded-lg bg-mist p-3 text-sm font-bold text-ink/60">Nothing here right now.</p> : null}
            </div>
          </section>
        ))}
      </div>
      {message ? <p className="mt-4 rounded-lg bg-blush/70 p-3 text-sm font-bold text-ink">{message}</p> : null}
    </div>
  );
}
