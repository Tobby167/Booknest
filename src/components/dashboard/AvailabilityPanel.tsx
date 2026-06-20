"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarPlus, ChevronLeft, ChevronRight, Clock, Plus, Trash2 } from "lucide-react";
import { BookNestLoader } from "@/components/BookNestLoader";
import type { Availability, BlockedDate, BlockedTime, Business } from "@/lib/types";

const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const weekDays = ["S", "M", "T", "W", "T", "F", "S"];

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function isoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function todayIso() {
  return isoDate(new Date());
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

function timeLabel(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  const date = new Date();
  date.setHours(hours, minutes || 0, 0, 0);
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

type Data = {
  business: Business | null;
  availability: Availability[];
  blockedDates: BlockedDate[];
  blockedTimes: BlockedTime[];
};

export function AvailabilityPanel() {
  const [data, setData] = useState<Data>({ business: null, availability: [], blockedDates: [], blockedTimes: [] });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [calendarMonth, setCalendarMonth] = useState(() => monthKey(new Date()));
  const [selectedDate, setSelectedDate] = useState(todayIso);
  const [blockMode, setBlockMode] = useState<"day" | "time">("day");

  const blockedByDate = useMemo(() => new Map(data.blockedDates.map((blockedDate) => [blockedDate.date, blockedDate])), [data.blockedDates]);
  const timeBlocksByDate = useMemo(() => {
    const map = new Map<string, BlockedTime[]>();
    data.blockedTimes.forEach((blockedTime) => {
      map.set(blockedTime.date, [...(map.get(blockedTime.date) ?? []), blockedTime]);
    });
    return map;
  }, [data.blockedTimes]);
  const selectedTimeBlocks = timeBlocksByDate.get(selectedDate) ?? [];
  const calendarDates = useMemo(() => calendarCells(calendarMonth), [calendarMonth]);

  async function load() {
    setLoading(true);
    const response = await fetch("/api/dashboard/availability");
    const payload = await response.json();
    setData({ business: payload.business ?? null, availability: payload.availability ?? [], blockedDates: payload.blockedDates ?? [], blockedTimes: payload.blockedTimes ?? [] });
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) return <BookNestLoader label="Loading dashboard" />;

  if (!data.business) {
    return (
      <div className="card p-6">
        <h1 className="text-2xl font-black text-ink">Create your business first</h1>
        <Link className="btn btn-primary mt-5" href="/dashboard/settings">
          Open settings
        </Link>
      </div>
    );
  }

  async function saveAvailability(event: FormEvent<HTMLFormElement>, existingId?: string) {
    event.preventDefault();
    if (!data.business) return;
    const formData = new FormData(event.currentTarget);
    const payload = {
      business_id: data.business.id,
      day_of_week: Number(formData.get("day_of_week")),
      start_time: String(formData.get("start_time")),
      end_time: String(formData.get("end_time")),
      is_available: formData.get("is_available") === "on"
    };

    const response = await fetch(`/api/availability${existingId ? `/${existingId}` : ""}`, {
      method: existingId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    setMessage(response.ok ? "Availability saved." : result.error || "Could not save availability.");
    if (response.ok) {
      setData((current) => ({
        ...current,
        availability: existingId
          ? current.availability.map((row) => (row.id === existingId ? result.availability : row))
          : [...current.availability, result.availability].sort((left, right) => left.day_of_week - right.day_of_week)
      }));
    }
  }

  async function deleteAvailability(id: string) {
    const response = await fetch(`/api/availability/${id}`, { method: "DELETE" });
    const result = await response.json();
    setMessage(response.ok ? "Availability removed." : result.error || "Could not remove availability.");
    if (response.ok) {
      setData((current) => ({ ...current, availability: current.availability.filter((row) => row.id !== id) }));
    }
  }

  async function blockDate(date: string, reason = "Blocked from calendar") {
    if (!data.business) return;
    const response = await fetch("/api/blocked-dates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ business_id: data.business.id, date, reason })
    });
    const result = await response.json();
    setMessage(response.ok ? "Full day blocked." : result.error || "Could not block date.");
    if (response.ok) {
      setData((current) => ({
        ...current,
        blockedDates: [...current.blockedDates.filter((blockedDate) => blockedDate.date !== result.blockedDate.date), result.blockedDate]
      }));
    }
  }

  async function deleteBlockedDate(id: string) {
    const response = await fetch(`/api/blocked-dates/${id}`, { method: "DELETE" });
    const result = await response.json();
    setMessage(response.ok ? "Full-day block removed." : result.error || "Could not remove blocked date.");
    if (response.ok) {
      setData((current) => ({ ...current, blockedDates: current.blockedDates.filter((blockedDate) => blockedDate.id !== id) }));
    }
  }

  async function blockTime(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data.business) return;
    const formData = new FormData(event.currentTarget);
    const response = await fetch("/api/blocked-times", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        business_id: data.business.id,
        date: selectedDate,
        start_time: String(formData.get("start_time")),
        end_time: String(formData.get("end_time")),
        reason: String(formData.get("reason") || "")
      })
    });
    const result = await response.json();
    setMessage(response.ok ? "Time blocked." : result.error || "Could not block time.");
    if (response.ok) {
      event.currentTarget.reset();
      setData((current) => ({ ...current, blockedTimes: [...current.blockedTimes, result.blockedTime].sort((left, right) => `${left.date}${left.start_time}`.localeCompare(`${right.date}${right.start_time}`)) }));
    }
  }

  async function deleteBlockedTime(id: string) {
    const response = await fetch(`/api/blocked-times/${id}`, { method: "DELETE" });
    const result = await response.json();
    setMessage(response.ok ? "Time block removed." : result.error || "Could not remove blocked time.");
    if (response.ok) {
      setData((current) => ({ ...current, blockedTimes: current.blockedTimes.filter((blockedTime) => blockedTime.id !== id) }));
    }
  }

  async function submitBlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const reason = String(formData.get("reason") || "");
    if (blockMode === "day") {
      await blockDate(selectedDate, reason);
      event.currentTarget.reset();
      return;
    }
    await blockTime(event);
  }

  function changeCalendarMonth(direction: -1 | 1) {
    const [year, month] = calendarMonth.split("-").map(Number);
    setCalendarMonth(monthKey(new Date(year, month - 1 + direction, 1)));
  }

  const selectedFullDayBlock = blockedByDate.get(selectedDate);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black text-ink">Availability</h1>
        <p className="mt-1 text-sm text-ink/60">Set weekly hours, block full days, or block only a specific time on a date.</p>
      </div>

      <div className="grid gap-5 2xl:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-xl border border-slate-300 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-black text-ink">Working Hours</h2>
              <p className="mt-1 text-xs font-bold text-ink/50">General weekly opening hours. Date and time blocks override this.</p>
            </div>
            <Clock className="h-5 w-5 text-purple-600" />
          </div>

          <div className="mt-5 grid gap-3">
            {data.availability.map((row) => (
              <form className="grid items-center gap-2 rounded-xl border border-slate-300 bg-white p-3 shadow-sm lg:grid-cols-[1fr_112px_112px_92px_auto]" key={row.id} onSubmit={(event) => saveAvailability(event, row.id)}>
                <select className="input focus-ring border-slate-300 bg-slate-50 font-bold" defaultValue={row.day_of_week} name="day_of_week">
                  {days.map((day, index) => (
                    <option key={day} value={index}>
                      {day}
                    </option>
                  ))}
                </select>
                <input className="input focus-ring border-slate-300 bg-slate-50" defaultValue={row.start_time.slice(0, 5)} name="start_time" type="time" />
                <input className="input focus-ring border-slate-300 bg-slate-50" defaultValue={row.end_time.slice(0, 5)} name="end_time" type="time" />
                <label className="flex items-center justify-center gap-2 rounded-full bg-purple-50 px-3 py-2 text-sm font-black text-purple-600">
                  <input defaultChecked={row.is_available} name="is_available" type="checkbox" /> Open
                </label>
                <div className="flex gap-2">
                  <button className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-black text-white">Save</button>
                  <button className="rounded-lg border border-slate-300 p-2 hover:border-rose-300" onClick={() => deleteAvailability(row.id)} title="Delete" type="button">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </form>
            ))}
          </div>

          <form className="mt-5 grid gap-2 rounded-xl border border-dashed border-purple-300 bg-purple-50/50 p-4 lg:grid-cols-[1fr_112px_112px_92px_auto]" onSubmit={(event) => saveAvailability(event)}>
            <select className="input focus-ring border-slate-300" name="day_of_week">
              {days.map((day, index) => (
                <option key={day} value={index}>
                  {day}
                </option>
              ))}
            </select>
            <input className="input focus-ring border-slate-300" defaultValue="09:00" name="start_time" type="time" />
            <input className="input focus-ring border-slate-300" defaultValue="18:00" name="end_time" type="time" />
            <label className="flex items-center justify-center gap-2 rounded-full bg-white px-3 py-2 text-sm font-black text-purple-600">
              <input defaultChecked name="is_available" type="checkbox" /> Open
            </label>
            <button className="btn btn-primary">
              <Plus className="h-4 w-4" /> Add
            </button>
          </form>
        </section>

        <section className="rounded-xl border border-slate-300 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-black text-ink">Block Calendar</h2>
              <p className="mt-1 text-xs font-bold text-ink/50">Pick a date, then block the whole day or only a time range.</p>
            </div>
            <CalendarPlus className="h-5 w-5 text-purple-600" />
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_0.95fr]">
            <div className="rounded-xl border border-slate-300 bg-white p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <button className="rounded-lg border border-slate-300 p-2 text-ink/70 hover:text-purple-600" onClick={() => changeCalendarMonth(-1)} type="button">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <p className="text-sm font-black text-ink">{monthLabel(calendarMonth)}</p>
                <button className="rounded-lg border border-slate-300 p-2 text-ink/70 hover:text-purple-600" onClick={() => changeCalendarMonth(1)} type="button">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center text-sm">
                {weekDays.map((day) => (
                  <span className="py-1 text-xs font-black text-ink/55" key={day}>
                    {day}
                  </span>
                ))}
                {calendarDates.map((dateValue, index) => {
                  const dateText = dateValue ? isoDate(dateValue) : "";
                  const blocked = dateText ? blockedByDate.has(dateText) : false;
                  const hasTimeBlocks = dateText ? Boolean(timeBlocksByDate.get(dateText)?.length) : false;
                  const selected = dateText === selectedDate;
                  return (
                    <button
                      className={`relative mx-auto grid aspect-square w-full max-w-11 place-items-center rounded-xl border text-sm transition ${
                        !dateValue
                          ? "invisible"
                          : selected
                            ? "border-purple-600 bg-purple-600 font-black text-white shadow-md"
                            : blocked
                              ? "border-slate-300 bg-slate-100 font-medium text-ink/35 line-through"
                              : hasTimeBlocks
                                ? "border-amber-300 bg-amber-50 font-black text-amber-700"
                                : "border-transparent font-black text-ink hover:border-purple-200 hover:bg-purple-50 hover:text-purple-600"
                      }`}
                      disabled={!dateValue}
                      key={`${dateText || "blank"}-${index}`}
                      onClick={() => dateText && setSelectedDate(dateText)}
                      type="button"
                    >
                      {dateValue?.getDate()}
                      {hasTimeBlocks && !selected ? <span className="absolute bottom-1 h-1 w-1 rounded-full bg-amber-500" /> : null}
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-black uppercase tracking-[0.08em] text-ink/50">
                <span className="rounded-full border border-slate-300 px-2 py-1">Grey = full day</span>
                <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-1 text-amber-700">Gold = time block</span>
              </div>
            </div>

            <div className="rounded-xl border border-slate-300 bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-purple-600">Selected date</p>
              <input className="input focus-ring mt-2 border-slate-300 bg-white" type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />

              <div className="mt-4 grid gap-2 rounded-xl bg-white p-1 sm:grid-cols-2">
                <button className={`rounded-lg px-3 py-2 text-sm font-black ${blockMode === "day" ? "bg-purple-600 text-white" : "text-ink/60"}`} onClick={() => setBlockMode("day")} type="button">
                  Whole day
                </button>
                <button className={`rounded-lg px-3 py-2 text-sm font-black ${blockMode === "time" ? "bg-purple-600 text-white" : "text-ink/60"}`} onClick={() => setBlockMode("time")} type="button">
                  Time only
                </button>
              </div>

              <form className="mt-4 grid gap-3" onSubmit={submitBlock}>
                {blockMode === "time" ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label>
                      <span className="label">Start</span>
                      <input className="input focus-ring border-slate-300 bg-white" defaultValue="12:00" name="start_time" type="time" required />
                    </label>
                    <label>
                      <span className="label">End</span>
                      <input className="input focus-ring border-slate-300 bg-white" defaultValue="13:00" name="end_time" type="time" required />
                    </label>
                  </div>
                ) : null}
                <label>
                  <span className="label">Reason</span>
                  <input className="input focus-ring border-slate-300 bg-white" name="reason" placeholder={blockMode === "day" ? "Closed, travel, holiday..." : "Lunch, school run, personal task..."} />
                </label>
                <button className="btn btn-primary">{blockMode === "day" ? "Block whole day" : "Block this time"}</button>
              </form>

              {selectedFullDayBlock ? (
                <div className="mt-4 rounded-xl border border-slate-300 bg-white p-3">
                  <p className="text-sm font-black text-ink">This full day is blocked.</p>
                  {selectedFullDayBlock.reason ? <p className="mt-1 text-sm text-ink/60">{selectedFullDayBlock.reason}</p> : null}
                  <button className="mt-3 rounded-lg border border-slate-300 px-3 py-2 text-sm font-black hover:border-rose-300" onClick={() => deleteBlockedDate(selectedFullDayBlock.id)} type="button">
                    Unblock full day
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-slate-300 bg-white p-4">
              <h3 className="font-black text-ink">Time blocks for {selectedDate}</h3>
              <div className="mt-3 grid gap-2">
                {selectedTimeBlocks.length ? (
                  selectedTimeBlocks.map((blockedTime) => (
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3" key={blockedTime.id}>
                      <div>
                        <p className="font-black text-ink">
                          {timeLabel(blockedTime.start_time)} - {timeLabel(blockedTime.end_time)}
                        </p>
                        {blockedTime.reason ? <p className="text-sm text-ink/60">{blockedTime.reason}</p> : null}
                      </div>
                      <button className="rounded-lg border border-amber-300 bg-white p-2 hover:border-rose-300" onClick={() => deleteBlockedTime(blockedTime.id)} title="Remove" type="button">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="rounded-xl bg-slate-50 p-3 text-sm font-bold text-ink/55">No time blocks for this date.</p>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-slate-300 bg-white p-4">
              <h3 className="font-black text-ink">Full-day blocks</h3>
              <div className="mt-3 grid max-h-64 gap-2 overflow-auto pr-1">
                {data.blockedDates.length ? (
                  data.blockedDates.map((blockedDate) => (
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3" key={blockedDate.id}>
                      <div>
                        <p className="font-black text-ink">{blockedDate.date}</p>
                        {blockedDate.reason ? <p className="text-sm text-ink/60">{blockedDate.reason}</p> : null}
                      </div>
                      <button className="rounded-lg border border-slate-300 bg-white p-2 hover:border-rose-300" onClick={() => deleteBlockedDate(blockedDate.id)} title="Remove" type="button">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="rounded-xl bg-slate-50 p-3 text-sm font-bold text-ink/55">No full-day blocks yet.</p>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>

      {message ? <p className="rounded-lg bg-purple-50 p-3 text-sm font-bold text-purple-700">{message}</p> : null}
    </div>
  );
}
