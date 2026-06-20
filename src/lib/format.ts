import type { PriceType } from "@/lib/types";

export function currency(value: number | null | undefined) {
  return currencyFor(value, "USD");
}

export function currencyFor(value: number | null | undefined, currencyCode = "USD") {
  if (value == null) return "Price varies";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode || "USD",
    maximumFractionDigits: value % 1 === 0 ? 0 : 2
  }).format(value);
}

export function priceLabel(priceType: PriceType | string | null | undefined, value: number | null | undefined, currencyCode = "USD") {
  if (priceType === "free") return "Included";
  if (priceType === "varies") return "Price varies";
  return currencyFor(value, currencyCode);
}

export function inlinePriceLabel(priceType: PriceType | string | null | undefined, value: number | null | undefined, currencyCode = "USD") {
  if (priceType === "free") return "included";
  if (priceType === "varies") return "price varies";
  return currencyFor(value, currencyCode);
}

export function timeLabel(time: string) {
  const [hourRaw, minuteRaw] = time.split(":");
  const date = new Date();
  date.setHours(Number(hourRaw), Number(minuteRaw), 0, 0);
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function dateLabel(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

export function durationLabel(minutes: number | null | undefined) {
  const total = Number(minutes || 0);
  if (total <= 0) return "Duration varies";

  const hours = Math.floor(total / 60);
  const mins = total % 60;
  const parts: string[] = [];

  if (hours) parts.push(`${hours} ${hours === 1 ? "hour" : "hours"}`);
  if (mins) parts.push(`${mins} ${mins === 1 ? "minute" : "minutes"}`);

  return parts.join(" ");
}

export function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
