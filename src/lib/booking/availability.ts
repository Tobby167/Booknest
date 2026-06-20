import type { Availability, BlockedDate, BlockedTime, Service, ServiceAddon, ServiceOption } from "@/lib/types";

export type BookedRange = {
  start_time: string;
  end_time: string;
};

type SlotInput = {
  date: string;
  service: Service;
  option?: ServiceOption | null;
  addons: ServiceAddon[];
  availability: Availability[];
  blockedDates: BlockedDate[];
  blockedTimes?: BlockedTime[];
  bookedRanges: BookedRange[];
  stepMinutes?: number;
  bookingNoticeHours?: number;
  maxAdvanceBookingDays?: number;
  defaultBufferAfterMinutes?: number;
};

const defaultAvailabilityStart = "09:00:00";
const defaultAvailabilityEnd = "18:00:00";

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:00`;
}

export function getBookingDurationMinutes(service: Service, option?: ServiceOption | null, addons: ServiceAddon[] = []) {
  const base = option?.duration_minutes ?? service.duration_minutes ?? 60;
  return base + addons.reduce((total, addon) => total + (addon.duration_minutes || 0), 0);
}

export function getBookingPrice(service: Service, option?: ServiceOption | null, addons: ServiceAddon[] = []) {
  const base = option
    ? option.price_type === "free"
      ? 0
      : option.price_type === "fixed"
        ? option.price
        : null
    : service.price_type === "free"
      ? 0
      : service.price_type === "fixed"
        ? service.base_price
        : null;

  if (base == null) return null;

  return addons.reduce((total, addon) => {
    if (addon.price_type !== "fixed" || addon.price == null) return total;
    return total + addon.price;
  }, base);
}

export function generateAvailableSlots(input: SlotInput) {
  const {
    date,
    service,
    option,
    addons,
    availability,
    blockedDates,
    blockedTimes = [],
    bookedRanges,
    stepMinutes = 15,
    bookingNoticeHours = 0,
    maxAdvanceBookingDays = 90,
    defaultBufferAfterMinutes = 0
  } = input;
  if (blockedDates.some((blockedDate) => blockedDate.date === date)) return [];

  const selectedDate = new Date(`${date}T12:00:00`);
  const now = new Date();
  const maxDate = new Date(now);
  maxDate.setDate(maxDate.getDate() + maxAdvanceBookingDays);
  maxDate.setHours(23, 59, 59, 999);
  if (selectedDate > maxDate) return [];

  const day = selectedDate.getDay();
  const duration = getBookingDurationMinutes(service, option, addons);
  const dayRows = availability.filter((row) => row.day_of_week === day);
  const rows = dayRows.length
    ? dayRows.filter((row) => row.is_available)
    : [
        {
          id: "default",
          business_id: service.business_id,
          day_of_week: day,
          start_time: defaultAvailabilityStart,
          end_time: defaultAvailabilityEnd,
          is_available: true
        }
      ];
  const earliestBookable = new Date(now.getTime() + bookingNoticeHours * 60 * 60 * 1000);

  const slots: string[] = [];
  for (const row of rows) {
    const workStart = timeToMinutes(row.start_time);
    const workEnd = timeToMinutes(row.end_time);

    for (let slotStart = workStart; slotStart + duration <= workEnd; slotStart += stepMinutes) {
      const slotEnd = slotStart + duration;
      const candidateStart = slotStart - service.buffer_before_minutes;
      const candidateEnd = slotEnd + service.buffer_after_minutes + defaultBufferAfterMinutes;
      const candidateDate = new Date(`${date}T${minutesToTime(slotStart)}`);
      if (candidateDate <= earliestBookable) continue;

      const conflicts = bookedRanges.some((range) => {
        const bookedStart = timeToMinutes(range.start_time);
        const bookedEnd = timeToMinutes(range.end_time);
        return candidateStart < bookedEnd && candidateEnd > bookedStart;
      });

      const blockedTimeConflict = blockedTimes
        .filter((blockedTime) => blockedTime.date === date)
        .some((blockedTime) => {
          const blockedStart = timeToMinutes(blockedTime.start_time);
          const blockedEnd = timeToMinutes(blockedTime.end_time);
          return candidateStart < blockedEnd && candidateEnd > blockedStart;
        });

      if (!conflicts && !blockedTimeConflict) slots.push(minutesToTime(slotStart));
    }
  }

  return Array.from(new Set(slots));
}
