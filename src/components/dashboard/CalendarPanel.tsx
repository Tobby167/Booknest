"use client";

import { useEffect, useMemo, useState } from "react";
import { BookNestLoader } from "@/components/BookNestLoader";
import { dateLabel, timeLabel } from "@/lib/format";
import type { Appointment, Availability, BlockedDate, Business } from "@/lib/types";

type AppointmentRow = Appointment & {
  services?: { name: string } | null;
  service_options?: { name: string } | null;
};

type ViewMode = "daily" | "weekly" | "monthly";

function toIso(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function inRange(value: string, start: Date, end: Date) {
  const date = new Date(`${value}T12:00:00`);
  return date >= start && date <= end;
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(monthValue: string) {
  const [year, month] = monthValue.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString([], { month: "long", year: "numeric" });
}

function calendarCells(monthValue: string) {
  const [year, month] = monthValue.split("-").map(Number);
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0).getDate();
  const blanks = Array.from({ length: firstDay.getDay() }, () => null);
  const dates = Array.from({ length: lastDay }, (_, index) => new Date(year, month - 1, index + 1));
  const cells = [...blanks, ...dates];
  return [...cells, ...Array.from({ length: Math.max(0, 42 - cells.length) }, () => null)];
}

export function CalendarPanel() {
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [business, setBusiness] = useState<Business | null>(null);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [mode, setMode] = useState<ViewMode>("weekly");
  const [anchor, setAnchor] = useState(toIso(new Date()));
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/appointments").then((response) => response.json()),
      fetch("/api/dashboard/availability").then((response) => response.json())
    ])
      .then(([appointmentData, availabilityData]) => {
        setAppointments(appointmentData.appointments ?? []);
        setBusiness(availabilityData.business ?? null);
        setAvailability(availabilityData.availability ?? []);
        setBlockedDates(availabilityData.blockedDates ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  const calendarMonth = mode === "monthly" ? anchor.slice(0, 7) : monthKey(new Date(`${anchor}T12:00:00`));
  const calendarDates = useMemo(() => calendarCells(calendarMonth), [calendarMonth]);
  const blockedByDate = useMemo(() => new Map(blockedDates.map((blockedDate) => [blockedDate.date, blockedDate])), [blockedDates]);
  const appointmentsByDate = useMemo(() => {
    return appointments.reduce<Record<string, AppointmentRow[]>>((groups, appointment) => {
      groups[appointment.appointment_date] ??= [];
      groups[appointment.appointment_date].push(appointment);
      return groups;
    }, {});
  }, [appointments]);
  const openDays = useMemo(() => new Set(availability.filter((row) => row.is_available).map((row) => row.day_of_week)), [availability]);

  const visible = useMemo(() => {
    const anchorDate = new Date(`${anchor}T12:00:00`);
    if (mode === "daily") return appointments.filter((appointment) => appointment.appointment_date === anchor);
    if (mode === "weekly") {
      const start = new Date(anchorDate);
      start.setDate(anchorDate.getDate() - anchorDate.getDay());
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return appointments.filter((appointment) => inRange(appointment.appointment_date, start, end));
    }
    return appointments.filter((appointment) => appointment.appointment_date.slice(0, 7) === anchor.slice(0, 7));
  }, [anchor, appointments, mode]);

  const grouped = visible.reduce<Record<string, AppointmentRow[]>>((groups, appointment) => {
    groups[appointment.appointment_date] ??= [];
    groups[appointment.appointment_date].push(appointment);
    return groups;
  }, {});

  async function blockDate(date: string) {
    if (!business) return;
    const response = await fetch("/api/blocked-dates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ business_id: business.id, date, reason: "Blocked from calendar" })
    });
    const payload = await response.json();
    setMessage(response.ok ? "Date blocked." : payload.error || "Could not block date.");
    if (response.ok) {
      setBlockedDates((current) => [...current.filter((row) => row.date !== payload.blockedDate.date), payload.blockedDate]);
    }
  }

  async function unblockDate(id: string) {
    const response = await fetch(`/api/blocked-dates/${id}`, { method: "DELETE" });
    const payload = await response.json();
    setMessage(response.ok ? "Date unblocked." : payload.error || "Could not unblock date.");
    if (response.ok) setBlockedDates((current) => current.filter((row) => row.id !== id));
  }

  async function toggleBlockedDate(date: string) {
    const blocked = blockedByDate.get(date);
    if (blocked) {
      await unblockDate(blocked.id);
      return;
    }
    await blockDate(date);
  }

  function moveMonth(direction: -1 | 1) {
    const [year, month] = calendarMonth.split("-").map(Number);
    const next = new Date(year, month - 1 + direction, 1);
    const nextAnchor = toIso(next);
    setAnchor(nextAnchor);
    if (mode !== "monthly") setMode("monthly");
  }

  if (loading) return <BookNestLoader label="Loading calendar" />;

  return (
    <div>
      <h1 className="text-2xl font-black text-ink">Internal calendar</h1>
      <div className="card mt-5 flex flex-wrap items-center gap-3 p-4">
        {(["daily", "weekly", "monthly"] as ViewMode[]).map((item) => (
          <button className={`btn ${mode === item ? "btn-primary" : "btn-secondary"}`} key={item} onClick={() => setMode(item)}>
            {item}
          </button>
        ))}
        <input className="input focus-ring max-w-56" type="date" value={anchor} onChange={(event) => setAnchor(event.target.value)} />
        <button className="btn btn-secondary" onClick={() => moveMonth(-1)}>Previous month</button>
        <button className="btn btn-secondary" onClick={() => moveMonth(1)}>Next month</button>
      </div>

      <section className="card mt-5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-black text-ink">{monthLabel(calendarMonth)}</h2>
          <div className="flex flex-wrap gap-2 text-xs font-black">
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-600">Available</span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-500">Closed</span>
            <span className="rounded-full bg-rose-50 px-3 py-1 text-rose-600">Blocked</span>
            <span className="rounded-full bg-purple-50 px-3 py-1 text-purple-600">Booked</span>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-7 gap-2 text-center">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <span className="py-1 text-xs font-black uppercase tracking-[0.12em] text-ink/45" key={day}>{day}</span>
          ))}
          {calendarDates.map((dateValue, index) => {
            const dateText = dateValue ? toIso(dateValue) : "";
            const isCurrentMonth = dateText.startsWith(calendarMonth);
            const blocked = dateText ? blockedByDate.get(dateText) : null;
            const dayAppointments = dateText ? appointmentsByDate[dateText] ?? [] : [];
            const available = dateValue ? openDays.has(dateValue.getDay()) : false;
            const selected = dateText === anchor;
            return (
              <button
                className={`min-h-24 rounded-xl border p-2 text-left transition ${
                  !dateValue
                    ? "invisible"
                    : selected
                      ? "border-purple-500 bg-purple-50"
                      : blocked
                        ? "border-rose-100 bg-rose-50"
                        : available
                          ? "border-emerald-100 bg-white hover:border-emerald-300"
                          : "border-slate-100 bg-slate-50 text-ink/35"
                } ${isCurrentMonth ? "" : "opacity-45"}`}
                disabled={!dateValue}
                key={`${dateText || "blank"}-${index}`}
                onClick={() => dateText && setAnchor(dateText)}
                type="button"
              >
                <span className="font-black">{dateValue?.getDate()}</span>
                <span className="mt-1 block text-[10px] font-black uppercase tracking-[0.08em]">
                  {blocked ? "Blocked" : dayAppointments.length ? `${dayAppointments.length} booked` : available ? "Available" : "Closed"}
                </span>
                <span
                  className="mt-2 inline-block rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-black text-ink/60"
                  onClick={(event) => {
                    event.stopPropagation();
                    if (dateText) void toggleBlockedDate(dateText);
                  }}
                >
                  {blocked ? "Unblock" : "Block"}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="mt-5 grid gap-4">
        {Object.entries(grouped).map(([date, rows]) => (
          <section className="card p-4" key={date}>
            <h2 className="font-black text-ink">{dateLabel(date)}</h2>
            <div className="mt-3 grid gap-2">
              {rows.map((appointment) => (
                <div className="rounded-lg border border-ink/10 bg-white p-3" key={appointment.id}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-black text-ink">
                      {timeLabel(appointment.start_time)} - {appointment.client_name}
                    </p>
                    <span className="pill bg-mist">{appointment.status.replaceAll("_", " ")}</span>
                  </div>
                  <p className="mt-1 text-sm text-ink/60">
                    {appointment.services?.name ?? "Service"} {appointment.service_options?.name ? `| ${appointment.service_options.name}` : ""}
                  </p>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
      {visible.length === 0 ? <p className="card mt-5 p-5 text-center font-bold text-ink/60">No appointments in this view.</p> : null}
      {message ? <p className="mt-5 rounded-lg bg-purple-50 p-3 text-sm font-bold text-purple-700">{message}</p> : null}
    </div>
  );
}
