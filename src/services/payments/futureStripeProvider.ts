// Future upgrade point:
// Implement Stripe Checkout, Payment Intents, and webhooks here later.
// Do not import Stripe or require STRIPE_SECRET_KEY until this integration is enabled.

export async function initializeStripePaymentLater() {
  throw new Error("Stripe is not configured in the MVP.");
}
