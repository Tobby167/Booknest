// Optional upgrade point:
// Add SMTP, Resend, SendGrid, or another email provider here when appointment
// emails are ready to become automated. BookNest keeps this optional so the app
// continues to run with in-app notifications and manual message templates.

export async function sendAppointmentEmailLater() {
  throw new Error("Appointment email provider is not configured.");
}
