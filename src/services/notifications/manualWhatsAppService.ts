import type { Appointment, Business, PaymentStatus } from "@/lib/types";
import { currency, dateLabel, timeLabel } from "@/lib/format";

export type WhatsAppTemplateType =
  | "booking_received"
  | "appointment_confirmed"
  | "payment_receipt_received"
  | "payment_rejected"
  | "reminder_24h"
  | "reminder_today"
  | "appointment_cancelled"
  | "appointment_rescheduled";

type TemplateInput = {
  business: Business;
  appointment: Appointment;
  serviceName?: string;
  optionName?: string;
  paymentStatus?: PaymentStatus;
};

export function buildManualMessage(type: WhatsAppTemplateType, input: TemplateInput) {
  const { business, appointment, serviceName = "your appointment", optionName } = input;
  const serviceLabel = optionName ? `${serviceName} (${optionName})` : serviceName;
  const appointmentLine = `${dateLabel(appointment.appointment_date)} at ${timeLabel(appointment.start_time)}`;

  const templates: Record<WhatsAppTemplateType, string> = {
    booking_received: `Hi ${appointment.client_name}, your booking request for ${serviceLabel} at ${business.name} was received for ${appointmentLine}. We will review it and confirm shortly.`,
    appointment_confirmed: `Hi ${appointment.client_name}, your appointment for ${serviceLabel} at ${business.name} is confirmed for ${appointmentLine}. Total: ${currency(appointment.total_price)}.`,
    payment_receipt_received: `Hi ${appointment.client_name}, we received your payment receipt for ${serviceLabel}. We will review it and update your booking status shortly.`,
    payment_rejected: `Hi ${appointment.client_name}, we could not confirm the uploaded payment receipt for ${serviceLabel}. Please contact ${business.name}${business.phone ? ` at ${business.phone}` : ""} so we can help.`,
    reminder_24h: `Hi ${appointment.client_name}, this is a friendly reminder that your ${serviceLabel} appointment at ${business.name} is tomorrow at ${timeLabel(appointment.start_time)}.`,
    reminder_today: `Hi ${appointment.client_name}, your ${serviceLabel} appointment at ${business.name} is today at ${timeLabel(appointment.start_time)}. See you soon.`,
    appointment_cancelled: `Hi ${appointment.client_name}, your appointment for ${serviceLabel} at ${business.name} on ${appointmentLine} has been cancelled. Please contact us if you need to rebook.`,
    appointment_rescheduled: `Hi ${appointment.client_name}, your appointment for ${serviceLabel} at ${business.name} has been rescheduled to ${appointmentLine}.`
  };

  return templates[type];
}

export function buildWhatsAppLink(phone: string | null | undefined, message: string) {
  const digits = (phone || "").replace(/[^\d]/g, "");
  const target = digits ? `/${digits}` : "";
  return `https://wa.me${target}?text=${encodeURIComponent(message)}`;
}
