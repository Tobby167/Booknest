import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function verifyStripeSignature(rawBody: string, signatureHeader: string | null, webhookSecret: string) {
  if (!signatureHeader) return false;

  const parts = Object.fromEntries(
    signatureHeader.split(",").map((part) => {
      const [key, value] = part.split("=");
      return [key, value];
    })
  );
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;

  const expected = crypto
    .createHmac("sha256", webhookSecret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");

  const expectedBuffer = Buffer.from(expected, "hex");
  const signatureBuffer = Buffer.from(signature, "hex");
  if (expectedBuffer.length !== signatureBuffer.length) return false;
  return crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
}

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) return NextResponse.json({ error: "Stripe webhook is not configured." }, { status: 500 });

  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!verifyStripeSignature(rawBody, signature, webhookSecret)) {
    return NextResponse.json({ error: "Invalid Stripe signature." }, { status: 400 });
  }

  let event: {
    type: string;
    data: {
      object: {
        id: string;
        payment_status?: string;
        payment_intent?: string;
        metadata?: {
          appointment_id?: string;
          payment_id?: string;
        };
      };
    };
  };

  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object;
  if (session.payment_status !== "paid") {
    return NextResponse.json({ received: true });
  }

  const paymentId = session.metadata?.payment_id;
  const appointmentId = session.metadata?.appointment_id;
  if (!paymentId || !appointmentId) {
    return NextResponse.json({ error: "Missing payment metadata." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  const { data: payment } = await supabase
    .from("payments")
    .select("id,business_id,appointment_id")
    .eq("id", paymentId)
    .eq("appointment_id", appointmentId)
    .maybeSingle();

  if (!payment) {
    return NextResponse.json({ error: "Payment metadata does not match an appointment." }, { status: 400 });
  }

  const { data: confirmedPayment } = await supabase
    .from("payments")
    .update({
      status: "confirmed",
      provider_payment_id: session.payment_intent ?? session.id,
      confirmed_at: new Date().toISOString()
    })
    .eq("id", paymentId)
    .select("business_id")
    .single();

  await supabase
    .from("appointments")
    .update({
      payment_status: "confirmed",
      status: "confirmed"
    })
    .eq("id", appointmentId)
    .eq("business_id", payment.business_id);

  if (confirmedPayment?.business_id) {
    const { data: business } = await supabase
      .from("businesses")
      .select("owner_id")
      .eq("id", confirmedPayment.business_id)
      .maybeSingle();

    await supabase.from("notifications").insert({
      business_id: confirmedPayment.business_id,
      user_id: business?.owner_id ?? null,
      appointment_id: appointmentId,
      type: "payment_confirmed",
      title: "Online payment confirmed",
      message: "Stripe confirmed this appointment payment automatically."
    });
  }

  return NextResponse.json({ received: true });
}
