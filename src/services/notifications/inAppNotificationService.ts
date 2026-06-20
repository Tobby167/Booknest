import type { Appointment, Business } from "@/lib/types";
import { dateLabel, timeLabel } from "@/lib/format";

export type NotificationDraft = {
  type: string;
  title: string;
  message: string;
};

export function newBookingNotification(business: Business, appointment: Appointment): NotificationDraft {
  return {
    type: "new_booking",
    title: "New appointment booked",
    message: `${appointment.client_name} booked ${business.name} for ${dateLabel(appointment.appointment_date)} at ${timeLabel(appointment.start_time)}.`
  };
}

export function upcomingAppointmentNotification(appointment: Appointment, label: "today" | "tomorrow" | "soon"): NotificationDraft {
  return {
    type: `appointment_${label}`,
    title: `Appointment ${label}`,
    message: `${appointment.client_name} is booked for ${dateLabel(appointment.appointment_date)} at ${timeLabel(appointment.start_time)}.`
  };
}
