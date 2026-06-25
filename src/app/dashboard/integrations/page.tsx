import type { Metadata } from "next";
import IntegrationsPanel from "@/components/dashboard/IntegrationsPanel";

export const metadata: Metadata = {
  title: "Integrations — BookNest",
  description: "Connect WhatsApp and Telegram to receive and manage bookings through chat."
};

export default function IntegrationsPage() {
  return <IntegrationsPanel />;
}
