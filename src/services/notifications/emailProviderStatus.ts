export type AppointmentEmailStatus = {
  configured: boolean;
  provider: "manual" | "smtp" | "resend" | "sendgrid";
  label: string;
  reason: string;
};

export function getAppointmentEmailStatus(): AppointmentEmailStatus {
  const provider = (process.env.APPOINTMENT_EMAIL_PROVIDER || "manual").toLowerCase();

  if (provider === "smtp") {
    const configured = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD);
    return {
      configured,
      provider: "smtp",
      label: "SMTP",
      reason: configured ? "SMTP email is ready for appointment messages." : "SMTP is selected but host, username, or password is missing."
    };
  }

  if (provider === "resend") {
    const configured = Boolean(process.env.RESEND_API_KEY);
    return {
      configured,
      provider: "resend",
      label: "Resend",
      reason: configured ? "Resend is ready for appointment messages." : "Resend is selected but RESEND_API_KEY is missing."
    };
  }

  if (provider === "sendgrid") {
    const configured = Boolean(process.env.SENDGRID_API_KEY);
    return {
      configured,
      provider: "sendgrid",
      label: "SendGrid",
      reason: configured ? "SendGrid is ready for appointment messages." : "SendGrid is selected but SENDGRID_API_KEY is missing."
    };
  }

  return {
    configured: false,
    provider: "manual",
    label: "Manual templates",
    reason: "Automated appointment email is off. BookNest still uses in-app notifications and copyable message templates."
  };
}
