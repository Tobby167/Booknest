// Future upgrade point:
// Implement Paystack payment initialization, verification, and webhooks here.
// The MVP uses manual bank transfer plus Supabase Storage receipt upload.

export async function initializePaystackPaymentLater() {
  throw new Error("Paystack is not configured in the MVP.");
}
