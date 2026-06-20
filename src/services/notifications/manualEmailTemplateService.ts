import type { Appointment, Business } from "@/lib/types";
import { currency, dateLabel, timeLabel } from "@/lib/format";

export type EmailTemplateType =
  | "confirmation"
  | "reminder"
  | "payment_receipt_confirmation"
  | "payment_rejection"
  | "cancellation"
  | "reschedule";

type EmailTemplateInput = {
  business: Business;
  appointment: Appointment;
  serviceName?: string;
  optionName?: string;
};

export function buildEmailTemplate(type: EmailTemplateType, input: EmailTemplateInput) {
  const { business, appointment, serviceName = "Appointment", optionName } = input;
  const serviceLabel = optionName ? `${serviceName} (${optionName})` : serviceName;
  const details = [
    `Service: ${serviceLabel}`,
    `Date: ${dateLabel(appointment.appointment_date)}`,
    `Time: ${timeLabel(appointment.start_time)}`,
    `Price: ${currency(appointment.total_price)}`,
    `Status: ${appointment.status}`,
    `Payment: ${appointment.payment_status}`,
    business.phone ? `Phone: ${business.phone}` : null,
    business.email ? `Email: ${business.email}` : null,
    business.address ? `Address: ${business.address}` : null
  ]
    .filter(Boolean)
    .join("\n");

  const subjects: Record<EmailTemplateType, string> = {
    confirmation: `Appointment confirmation from ${business.name}`,
    reminder: `Reminder for your ${business.name} appointment`,
    payment_receipt_confirmation: `Payment receipt confirmed by ${business.name}`,
    payment_rejection: `Payment receipt update from ${business.name}`,
    cancellation: `Appointment cancelled by ${business.name}`,
    reschedule: `Appointment rescheduled by ${business.name}`
  };

  const intros: Record<EmailTemplateType, string> = {
    confirmation: `Hi ${appointment.client_name},\n\nYour appointment has been confirmed.`,
    reminder: `Hi ${appointment.client_name},\n\nThis is a friendly reminder about your upcoming appointment.`,
    payment_receipt_confirmation: `Hi ${appointment.client_name},\n\nYour payment receipt has been confirmed.`,
    payment_rejection: `Hi ${appointment.client_name},\n\nWe could not confirm your payment receipt. Please contact us so we can help.`,
    cancellation: `Hi ${appointment.client_name},\n\nYour appointment has been cancelled.`,
    reschedule: `Hi ${appointment.client_name},\n\nYour appointment has been rescheduled.`
  };

  return {
    subject: subjects[type],
    body: `${intros[type]}\n\n${details}\n\nThank you,\n${business.name}`
  };
}
