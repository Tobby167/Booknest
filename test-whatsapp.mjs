/**
 * Quick WhatsApp connection test.
 * Run with: node test-whatsapp.mjs <your_phone_number>
 * Phone number must be in international format with no +, e.g. 2348012345678
 */

const PHONE_NUMBER_ID = process.env.PLATFORM_WA_PHONE_NUMBER_ID;
const ACCESS_TOKEN    = process.env.PLATFORM_WA_ACCESS_TOKEN;
const TO              = process.argv[2];

if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) {
  console.error("❌  Missing PLATFORM_WA_PHONE_NUMBER_ID or PLATFORM_WA_ACCESS_TOKEN in env.");
  process.exit(1);
}

if (!TO) {
  console.error("❌  Usage: node test-whatsapp.mjs <phone_in_international_format>");
  console.error("    e.g.   node test-whatsapp.mjs 2348012345678");
  process.exit(1);
}

const url  = `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`;
const body = {
  messaging_product: "whatsapp",
  recipient_type:    "individual",
  to:                TO,
  type:              "text",
  text: { preview_url: false, body: "✅ Acuity WhatsApp integration is working! This is a test message." }
};

console.log(`\n📤  Sending test message to +${TO} via Phone ID ${PHONE_NUMBER_ID}…\n`);

const res  = await fetch(url, {
  method:  "POST",
  headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, "Content-Type": "application/json" },
  body:    JSON.stringify(body)
});

const json = await res.json();

if (res.ok) {
  console.log("✅  SUCCESS! Message sent.");
  console.log("    Message ID:", json.messages?.[0]?.id);
} else {
  console.error("❌  FAILED:", JSON.stringify(json, null, 2));
}
