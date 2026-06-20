// Future upgrade point:
// Add Termii, Twilio, Africa's Talking, or another SMS provider here later.
// Keep this optional so BookNest continues to run without paid API keys.

export async function sendSmsLater() {
  throw new Error("SMS provider is not configured in the MVP.");
}
