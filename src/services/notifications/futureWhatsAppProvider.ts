// Future upgrade point:
// Add WhatsApp Cloud API support here later. The MVP uses manual wa.me links
// generated in manualWhatsAppService.ts, so no WhatsApp API key is required.

export async function sendWhatsAppMessageLater() {
  throw new Error("WhatsApp provider is not configured in the MVP.");
}
