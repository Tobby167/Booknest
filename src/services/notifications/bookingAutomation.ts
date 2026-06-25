/**
 * bookingAutomation.ts
 *
 * Deterministic, state-machine based conversational booking engine.
 * Zero AI dependencies — all routing is rule-based keyword parsing.
 *
 * State machine flow:
 *
 *  idle
 *   └─ "1" / "book"        → awaiting_service
 *   └─ "2" / "my booking"  → show_bookings
 *   └─ "3" / "cancel"      → awaiting_cancel_select
 *   └─ "4" / "reschedule"  → awaiting_reschedule_select
 *
 *  awaiting_service
 *   └─ index / name match  → awaiting_option (if service has options) | awaiting_date
 *
 *  awaiting_option
 *   └─ index               → awaiting_date
 *
 *  awaiting_date
 *   └─ "today" / "tomorrow" / YYYY-MM-DD → awaiting_time
 *
 *  awaiting_time
 *   └─ index               → awaiting_name (if no client) | awaiting_confirm
 *
 *  awaiting_name            → awaiting_confirm
 *  awaiting_confirm
 *   └─ "confirm"           → create booking → idle
 *   └─ "cancel"            → idle
 *
 *  Any state: "menu" | "reset" | "0" → idle
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { generateAvailableSlots } from "@/lib/booking/availability";
import type { Availability, BlockedDate, Service, ServiceOption } from "@/lib/types";

// ─── Types ───────────────────────────────────────────────────────────────────

export type ConversationState = {
  step: Step;
  service_id?: string;
  service_name?: string;
  option_id?: string | null;
  option_name?: string | null;
  date?: string;
  slots?: string[];
  time?: string;
  client_name?: string;
  client_id?: string | null;
};

type Step =
  | "idle"
  | "awaiting_service"
  | "awaiting_option"
  | "awaiting_date"
  | "awaiting_time"
  | "awaiting_name"
  | "awaiting_confirm"
  | "awaiting_cancel_select"
  | "awaiting_reschedule_select"
  | "awaiting_reschedule_date"
  | "awaiting_reschedule_time"
  | "show_bookings";

export type ProcessResult = {
  reply: string;
  newState: ConversationState;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(time: string) {
  const [h, m] = time.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

function parseDate(input: string): string | null {
  const lower = input.toLowerCase().trim();
  const today = new Date();
  if (lower === "today") return today.toISOString().slice(0, 10);
  if (lower === "tomorrow") {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }
  // Try YYYY-MM-DD or DD/MM/YYYY or DD-MM-YYYY
  const isoMatch = lower.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const candidate = `${isoMatch[1]}-${String(isoMatch[2]).padStart(2, "0")}-${String(isoMatch[3]).padStart(2, "0")}`;
    if (!isNaN(Date.parse(candidate))) return candidate;
  }
  const slashMatch = lower.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (slashMatch) {
    const candidate = `${slashMatch[3]}-${String(slashMatch[2]).padStart(2, "0")}-${String(slashMatch[1]).padStart(2, "0")}`;
    if (!isNaN(Date.parse(candidate))) return candidate;
  }
  return null;
}

function isReset(text: string): boolean {
  const t = text.toLowerCase().trim();
  // /start and /menu are Telegram built-in slash commands
  return ["menu", "/menu", "reset", "0", "home", "start", "/start", "hi", "hello", "/help", "help"].includes(t);
}

function isCancelCommand(text: string): boolean {
  return ["cancel", "stop", "quit", "back"].includes(text.toLowerCase().trim());
}

function buildMenu(businessName = "BookNest"): string {
  return (
    `👋 Welcome to *${businessName}*!\n\nWhat would you like to do?\n\n` +
    `1️⃣  Book an appointment\n` +
    `2️⃣  View my upcoming bookings\n` +
    `3️⃣  Cancel an appointment\n` +
    `4️⃣  Reschedule an appointment\n\n` +
    `Reply with a number to get started.`
  );
}

// ─── Main Processor ───────────────────────────────────────────────────────────

export async function processMessage(
  supabase: SupabaseClient,
  businessId: string,
  businessSlug: string,
  externalChatId: string,
  customerName: string,
  currentState: ConversationState,
  incomingText: string
): Promise<ProcessResult> {
  // Fetch the business name once so messages are personalised
  const { data: bizRow } = await supabase
    .from("businesses")
    .select("name")
    .eq("id", businessId)
    .maybeSingle();
  const businessName = (bizRow as { name: string } | null)?.name ?? "BookNest";
  const text = incomingText.trim();
  const step = currentState.step ?? "idle";

  // ── Global resets ───────────────────────────────────────────────────────
  if (isReset(text) && step !== "idle") {
    return { reply: buildMenu(businessName), newState: { step: "idle" } };
  }

  // ── idle ────────────────────────────────────────────────────────────────
  if (step === "idle") {
    const choice = text.trim();
    // Support both number replies and Telegram slash commands
    if (choice === "1" || /^(\/book|book)$/i.test(choice)) {
      const { data: services } = await supabase
        .from("services")
        .select("id, name, duration_minutes, base_price, price_type")
        .eq("business_id", businessId)
        .eq("is_active", true)
        .order("display_order");

      if (!services || services.length === 0) {
        return { reply: "Sorry, no services are currently available. Please try again later.", newState: { step: "idle" } };
      }

      const list = (services as { id: string; name: string }[]).map((s, i) => `${i + 1}. ${s.name}`).join("\n");
      return {
        reply: `Great! Please choose a service:\n\n${list}\n\nReply with a number.`,
        newState: { step: "awaiting_service" }
      };
    }
    if (choice === "2" || /^(\/bookings?|my booking|upcoming)$/i.test(choice)) {
      return await handleShowBookings(supabase, businessId, externalChatId);
    }
    if (choice === "3" || /^(\/cancel|cancel)$/i.test(choice)) {
      return await handleCancelSelect(supabase, businessId, externalChatId);
    }
    if (choice === "4" || /^(\/reschedule|reschedule)$/i.test(choice)) {
      return await handleRescheduleSelect(supabase, businessId, externalChatId);
    }

    return { reply: buildMenu(businessName), newState: { step: "idle" } };
  }

  // ── awaiting_service ────────────────────────────────────────────────────
  if (step === "awaiting_service") {
    const { data: services } = await supabase
      .from("services")
      .select("id, name, duration_minutes, base_price, price_type, buffer_before_minutes, buffer_after_minutes")
      .eq("business_id", businessId)
      .eq("is_active", true)
      .order("display_order");

    if (!services || services.length === 0) {
      return { reply: "No services available.", newState: { step: "idle" } };
    }

    type ServiceRow = { id: string; name: string; duration_minutes: number | null; base_price: number | null; price_type: string; buffer_before_minutes: number; buffer_after_minutes: number };
    const idx = parseInt(text) - 1;
    const byName = (services as ServiceRow[]).findIndex(s => s.name.toLowerCase().includes(text.toLowerCase()));
    const picked = (services as ServiceRow[])[isNaN(idx) ? byName : idx];

    if (!picked) {
      const list = (services as ServiceRow[]).map((s, i) => `${i + 1}. ${s.name}`).join("\n");
      return {
        reply: `I didn't recognise that. Please reply with a number:\n\n${list}`,
        newState: { step: "awaiting_service" }
      };
    }

    // Check for service options
    const { data: options } = await supabase
      .from("service_options")
      .select("id, name, price, price_type, duration_minutes")
      .eq("service_id", picked.id)
      .eq("is_active", true)
      .order("display_order");

    type OptionRow = { id: string; name: string; price: number | null; price_type: string; duration_minutes: number | null };
    if (options && options.length > 0) {
      const list = (options as OptionRow[]).map((o, i) => `${i + 1}. ${o.name}`).join("\n");
      return {
        reply: `You picked *${picked.name}*. Now choose an option:\n\n${list}\n\nReply with a number.`,
        newState: { step: "awaiting_option", service_id: picked.id, service_name: picked.name }
      };
    }

    return {
      reply: `You picked *${picked.name}*.\n\nWhat date would you like?\nReply with: today, tomorrow, or a date like 2026-07-15`,
      newState: { step: "awaiting_date", service_id: picked.id, service_name: picked.name, option_id: null, option_name: null }
    };
  }

  // ── awaiting_option ─────────────────────────────────────────────────────
  if (step === "awaiting_option" && currentState.service_id) {
    const { data: options } = await supabase
      .from("service_options")
      .select("id, name, price, price_type, duration_minutes")
      .eq("service_id", currentState.service_id)
      .eq("is_active", true)
      .order("display_order");

    type OptionRow2 = { id: string; name: string; price: number | null; price_type: string; duration_minutes: number | null };
    const idx = parseInt(text) - 1;
    const picked = (options as OptionRow2[] | null)?.[isNaN(idx) ? -1 : idx];

    if (!picked) {
      const list = ((options ?? []) as OptionRow2[]).map((o, i) => `${i + 1}. ${o.name}`).join("\n");
      return {
        reply: `Please reply with a number:\n\n${list}`,
        newState: { ...currentState, step: "awaiting_option" }
      };
    }

    return {
      reply: `Great choice! *${picked.name}*.\n\nWhat date would you like?\nReply with: today, tomorrow, or a date like 2026-07-15`,
      newState: { ...currentState, step: "awaiting_date", option_id: picked.id, option_name: picked.name }
    };
  }

  // ── awaiting_date ───────────────────────────────────────────────────────
  if (step === "awaiting_date" && currentState.service_id) {
    const parsedDate = parseDate(text);
    if (!parsedDate) {
      return {
        reply: `I couldn't read that date. Please reply with: today, tomorrow, or a date like 2026-07-15`,
        newState: { ...currentState, step: "awaiting_date" }
      };
    }
    if (parsedDate < new Date().toISOString().slice(0, 10)) {
      return {
        reply: `That date is in the past. Please choose a future date.`,
        newState: { ...currentState, step: "awaiting_date" }
      };
    }

    // Fetch availability data
    const { data: service } = await supabase
      .from("services")
      .select("*")
      .eq("id", currentState.service_id)
      .single();

    const { data: option } = currentState.option_id
      ? await supabase.from("service_options").select("*").eq("id", currentState.option_id).single()
      : { data: null };

    const { data: availability } = await supabase
      .from("availability")
      .select("*")
      .eq("business_id", businessId);

    const { data: blockedDates } = await supabase
      .from("blocked_dates")
      .select("*")
      .eq("business_id", businessId);

    const { data: bookedRanges } = await supabase.rpc("get_booked_appointment_ranges", {
      p_business_slug: businessSlug,
      p_date: parsedDate
    });

    const slots = generateAvailableSlots({
      date: parsedDate,
      service: service as Service,
      option: option as ServiceOption | null,
      addons: [],
      availability: (availability ?? []) as Availability[],
      blockedDates: (blockedDates ?? []) as BlockedDate[],
      bookedRanges: bookedRanges ?? []
    });

    if (slots.length === 0) {
      return {
        reply: `Unfortunately there are no available slots on ${parsedDate}. Please try another date.`,
        newState: { ...currentState, step: "awaiting_date" }
      };
    }

    const list = slots.map((s, i) => `${i + 1}. ${formatTime(s)}`).join("\n");
    return {
      reply: `Available times on ${parsedDate}:\n\n${list}\n\nReply with a number to select your time.`,
      newState: { ...currentState, step: "awaiting_time", date: parsedDate, slots }
    };
  }

  // ── awaiting_time ───────────────────────────────────────────────────────
  if (step === "awaiting_time" && currentState.slots) {
    const idx = parseInt(text) - 1;
    const pickedTime = currentState.slots[isNaN(idx) ? -1 : idx];

    if (!pickedTime) {
      const list = currentState.slots.map((s, i) => `${i + 1}. ${formatTime(s)}`).join("\n");
      return {
        reply: `Please reply with a number:\n\n${list}`,
        newState: { ...currentState, step: "awaiting_time" }
      };
    }

    // Do we know the client's name already?
    if (!currentState.client_name && customerName) {
      return {
        reply: `Perfect! Your appointment is set for ${currentState.date} at ${formatTime(pickedTime)}.\n\nWhat is your full name?`,
        newState: { ...currentState, step: "awaiting_name", time: pickedTime }
      };
    }

    const name = currentState.client_name ?? customerName;
    const summary = buildSummary(currentState, pickedTime, name);
    return {
      reply: `${summary}\n\nReply CONFIRM to book or CANCEL to start over.`,
      newState: { ...currentState, step: "awaiting_confirm", time: pickedTime, client_name: name }
    };
  }

  // ── awaiting_name ───────────────────────────────────────────────────────
  if (step === "awaiting_name") {
    const name = text.trim();
    if (name.length < 2) {
      return { reply: `Please enter your full name.`, newState: { ...currentState, step: "awaiting_name" } };
    }
    const summary = buildSummary(currentState, currentState.time!, name);
    return {
      reply: `${summary}\n\nReply CONFIRM to book or CANCEL to start over.`,
      newState: { ...currentState, step: "awaiting_confirm", client_name: name }
    };
  }

  // ── awaiting_confirm ────────────────────────────────────────────────────
  if (step === "awaiting_confirm") {
    if (isCancelCommand(text) || text.toLowerCase() === "cancel") {
      return { reply: buildMenu(businessName), newState: { step: "idle" } };
    }
    if (text.toLowerCase() === "confirm" || text === "1" || /yes|ok|sure/i.test(text)) {
      return await createBooking(supabase, businessSlug, currentState, externalChatId);
    }
    return {
      reply: `Reply CONFIRM to book your appointment or CANCEL to start over.`,
      newState: { ...currentState, step: "awaiting_confirm" }
    };
  }

  // ── awaiting_cancel_select ──────────────────────────────────────────────
  if (step === "awaiting_cancel_select") {
    return await processCancelSelection(supabase, businessId, externalChatId, text, currentState);
  }

  // ── awaiting_reschedule_select ──────────────────────────────────────────
  if (step === "awaiting_reschedule_select") {
    return await processRescheduleSelection(supabase, businessId, externalChatId, text, currentState);
  }

  // ── awaiting_reschedule_date ────────────────────────────────────────────
  if (step === "awaiting_reschedule_date" && currentState.service_id) {
    const parsedDate = parseDate(text);
    if (!parsedDate || parsedDate < new Date().toISOString().slice(0, 10)) {
      return { reply: `Please enter a valid future date (e.g. tomorrow, 2026-07-15).`, newState: { ...currentState, step: "awaiting_reschedule_date" } };
    }

    const { data: service } = await supabase.from("services").select("*").eq("id", currentState.service_id).single();
    const { data: availability } = await supabase.from("availability").select("*").eq("business_id", businessId);
    const { data: blockedDates } = await supabase.from("blocked_dates").select("*").eq("business_id", businessId);
    const { data: bookedRanges } = await supabase.rpc("get_booked_appointment_ranges", { p_business_slug: businessSlug, p_date: parsedDate });

    const slots = generateAvailableSlots({
      date: parsedDate,
      service: service as Service,
      option: null,
      addons: [],
      availability: (availability ?? []) as Availability[],
      blockedDates: (blockedDates ?? []) as BlockedDate[],
      bookedRanges: bookedRanges ?? []
    });

    if (slots.length === 0) {
      return { reply: `No slots available on ${parsedDate}. Try another date.`, newState: { ...currentState, step: "awaiting_reschedule_date" } };
    }

    const list = slots.map((s, i) => `${i + 1}. ${formatTime(s)}`).join("\n");
    return {
      reply: `Available times on ${parsedDate}:\n\n${list}\n\nReply with a number.`,
      newState: { ...currentState, step: "awaiting_reschedule_time", date: parsedDate, slots }
    };
  }

  // ── awaiting_reschedule_time ────────────────────────────────────────────
  if (step === "awaiting_reschedule_time" && currentState.slots && currentState.date) {
    const idx = parseInt(text) - 1;
    const pickedTime = currentState.slots[isNaN(idx) ? -1 : idx];
    if (!pickedTime) {
      const list = currentState.slots.map((s, i) => `${i + 1}. ${formatTime(s)}`).join("\n");
      return { reply: `Please reply with a number:\n\n${list}`, newState: { ...currentState, step: "awaiting_reschedule_time" } };
    }

    // Perform reschedule in DB
    const { error } = await supabase
      .from("appointments")
      .update({ appointment_date: currentState.date, start_time: pickedTime, status: "pending" })
      .eq("id", (currentState as ConversationState & { appointment_id?: string }).appointment_id ?? "");

    if (error) {
      return { reply: `Sorry, we couldn't reschedule your appointment. Please try again.`, newState: { step: "idle" } };
    }

    return {
      reply: `✅ Your appointment has been rescheduled to ${currentState.date} at ${formatTime(pickedTime)}.\n\nReply "menu" any time to return to the main menu.`,
      newState: { step: "idle" }
    };
  }

  // ── Fallback ────────────────────────────────────────────────────────────
  return { reply: buildMenu(businessName), newState: { step: "idle" } };
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

function buildSummary(state: ConversationState, time: string, name: string): string {
  return (
    `📋 *Booking Summary*\n\n` +
    `Service: ${state.service_name}${state.option_name ? ` (${state.option_name})` : ""}\n` +
    `Date: ${state.date}\n` +
    `Time: ${formatTime(time)}\n` +
    `Name: ${name}`
  );
}

async function createBooking(
  supabase: SupabaseClient,
  businessSlug: string,
  state: ConversationState,
  externalChatId: string
): Promise<ProcessResult> {
  try {
    const { data, error } = await supabase.rpc("create_public_booking", {
      p_business_slug: businessSlug,
      p_service_id: state.service_id,
      p_service_option_id: state.option_id ?? null,
      p_addon_ids: [],
      p_appointment_date: state.date,
      p_start_time: state.time,
      p_client_name: state.client_name ?? "Guest",
      p_client_email: null,
      p_client_phone: externalChatId,
      p_notes: "Booked via WhatsApp/Telegram",
      p_receipt_image_url: null,
      p_form_answers: []
    });

    if (error) throw error;

    return {
      reply:
        `✅ *Your appointment is confirmed!*\n\n` +
        `Service: ${state.service_name}\n` +
        `Date: ${state.date}\n` +
        `Time: ${formatTime(state.time!)}\n\n` +
        `Booking ID: ${(data as { appointment_id: string })?.appointment_id?.slice(0, 8).toUpperCase()}\n\n` +
        `We'll send you a reminder before your appointment. Reply "menu" to return to the main menu.`,
      newState: { step: "idle" }
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return {
      reply: `❌ Sorry, we couldn't complete your booking: ${msg}\n\nReply "menu" to try again.`,
      newState: { step: "idle" }
    };
  }
}

async function handleShowBookings(
  supabase: SupabaseClient,
  businessId: string,
  externalChatId: string
): Promise<ProcessResult> {
  const { data: appointments } = await supabase
    .from("appointments")
    .select("id, appointment_date, start_time, status, services(name)")
    .eq("business_id", businessId)
    .eq("client_phone", externalChatId)
    .in("status", ["pending", "confirmed", "pending_confirmation"])
    .order("appointment_date", { ascending: true })
    .limit(5);

  if (!appointments || appointments.length === 0) {
    return {
      reply: `You have no upcoming appointments.\n\nReply "menu" to return to the main menu.`,
      newState: { step: "idle" }
    };
  }

  const list = appointments.map((a, i) => {
    const svc = (a.services as unknown as { name: string } | null)?.name ?? "Appointment";
    return `${i + 1}. ${svc} — ${a.appointment_date} at ${formatTime(a.start_time)} (${a.status})`;
  }).join("\n");

  return {
    reply: `📅 *Upcoming Appointments*\n\n${list}\n\nReply "menu" to return to the main menu.`,
    newState: { step: "idle" }
  };
}

async function handleCancelSelect(
  supabase: SupabaseClient,
  businessId: string,
  externalChatId: string
): Promise<ProcessResult> {
  const { data: appointments } = await supabase
    .from("appointments")
    .select("id, appointment_date, start_time, services(name)")
    .eq("business_id", businessId)
    .eq("client_phone", externalChatId)
    .in("status", ["pending", "confirmed", "pending_confirmation"])
    .order("appointment_date", { ascending: true })
    .limit(5);

  if (!appointments || appointments.length === 0) {
    return { reply: `You have no upcoming appointments to cancel.\n\nReply "menu" to return.`, newState: { step: "idle" } };
  }

  const list = appointments.map((a, i) => {
    const svc = (a.services as unknown as { name: string } | null)?.name ?? "Appointment";
    return `${i + 1}. ${svc} — ${a.appointment_date} at ${formatTime(a.start_time)}`;
  }).join("\n");

  return {
    reply: `Which appointment would you like to cancel?\n\n${list}\n\nReply with a number or "menu" to go back.`,
    newState: { step: "awaiting_cancel_select", slots: appointments.map(a => a.id) }
  };
}

async function processCancelSelection(
  supabase: SupabaseClient,
  businessId: string,
  externalChatId: string,
  text: string,
  state: ConversationState
): Promise<ProcessResult> {
  const idx = parseInt(text) - 1;
  const appointmentId = state.slots?.[isNaN(idx) ? -1 : idx];
  if (!appointmentId) {
    return { reply: `Please reply with a valid number.`, newState: { ...state, step: "awaiting_cancel_select" } };
  }

  const { error } = await supabase
    .from("appointments")
    .update({ status: "cancelled" })
    .eq("id", appointmentId)
    .eq("business_id", businessId);

  if (error) return { reply: `Sorry, we couldn't cancel that appointment. Please contact us directly.`, newState: { step: "idle" } };

  return {
    reply: `✅ Your appointment has been cancelled.\n\nReply "menu" to return to the main menu.`,
    newState: { step: "idle" }
  };
}

async function handleRescheduleSelect(
  supabase: SupabaseClient,
  businessId: string,
  externalChatId: string
): Promise<ProcessResult> {
  const { data: appointments } = await supabase
    .from("appointments")
    .select("id, appointment_date, start_time, service_id, services(name)")
    .eq("business_id", businessId)
    .eq("client_phone", externalChatId)
    .in("status", ["pending", "confirmed", "pending_confirmation"])
    .order("appointment_date", { ascending: true })
    .limit(5);

  if (!appointments || appointments.length === 0) {
    return { reply: `You have no upcoming appointments to reschedule.\n\nReply "menu" to return.`, newState: { step: "idle" } };
  }

  const list = appointments.map((a, i) => {
    const svc = (a.services as unknown as { name: string } | null)?.name ?? "Appointment";
    return `${i + 1}. ${svc} — ${a.appointment_date} at ${formatTime(a.start_time)}`;
  }).join("\n");

  return {
    reply: `Which appointment would you like to reschedule?\n\n${list}\n\nReply with a number.`,
    newState: {
      step: "awaiting_reschedule_select",
      slots: appointments.map(a => a.id),
      service_id: undefined
    }
  };
}

async function processRescheduleSelection(
  supabase: SupabaseClient,
  businessId: string,
  externalChatId: string,
  text: string,
  state: ConversationState
): Promise<ProcessResult> {
  const idx = parseInt(text) - 1;
  const appointmentId = state.slots?.[isNaN(idx) ? -1 : idx];
  if (!appointmentId) {
    return { reply: `Please reply with a valid number.`, newState: { ...state, step: "awaiting_reschedule_select" } };
  }

  const { data: appt } = await supabase
    .from("appointments")
    .select("service_id")
    .eq("id", appointmentId)
    .single();

  return {
    reply: `What date would you like to reschedule to?\nReply with: today, tomorrow, or a date like 2026-07-15`,
    newState: {
      step: "awaiting_reschedule_date",
      service_id: appt?.service_id,
      ...(({ appointment_id: appointmentId }) => ({ appointment_id: appointmentId }))({ appointment_id: appointmentId })
    } as ConversationState & { appointment_id: string }
  };
}
