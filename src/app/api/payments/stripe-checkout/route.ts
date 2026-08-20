import { fail, ok, safeError } from "@/lib/api";
import { getSiteUrl } from "@/lib/env";
import { getRequestKey, rateLimit } from "@/lib/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createStripeCheckoutSession } from "@/services/payments/stripeCheckoutProvider";

type AppointmentForPayment = {
  id: string;
  business_id: string;
  client_email: string | null;
  client_phone: string | null;
  client_name: string;
  payment_status: string;
  status: string;
  total_price: number | null;
  businesses: { name: string; slug: string; plan?: string; is_lifetime?: boolean } | null;
  services: { name: string } | null;
  payments: { id: string; amount: number | null; status: string }[];
};

export async function POST(request: Request) {
  const limit = rateLimit(getRequestKey(request, "stripe-checkout"), 8, 60_000);
  if (!limit.allowed) return fail("Too many checkout attempts. Please wait a moment and try again.", 429);

  let body: { appointmentId?: string; clientEmail?: string; clientPhone?: string };
  try {
    body = await request.json();
  } catch {
    return fail("Invalid request body.");
  }

  if (!body.appointmentId) return fail("appointmentId is required.");

  let supabase;
  try {
    supabase = createSupabaseAdminClient();
  } catch (error) {
    return fail("Payment admin client is not configured.", 500);
  }

  const { data: appointment, error } = await supabase
    .from("appointments")
    .select("id,business_id,client_email,client_phone,client_name,payment_status,status,total_price,businesses(name,slug,plan,is_lifetime),services(name),payments(id,amount,status)")
    .eq("id", body.appointmentId)
    .maybeSingle<AppointmentForPayment>();

  if (error) return safeError();
  if (!appointment) return fail("Appointment not found.", 404);

  if (appointment.businesses?.plan === "starter" && !appointment.businesses?.is_lifetime) {
    return fail("This business does not support online card payments.", 403);
  }

  const emailMatches =
    appointment.client_email &&
    body.clientEmail &&
    appointment.client_email.trim().toLowerCase() === body.clientEmail.trim().toLowerCase();
  const phoneMatches =
    appointment.client_phone &&
    body.clientPhone &&
    appointment.client_phone.replace(/\D/g, "") === body.clientPhone.replace(/\D/g, "");

  if (!emailMatches && !phoneMatches) {
    return fail("Appointment contact verification failed.", 403);
  }

  const amount = appointment.total_price;

  if (!amount || amount <= 0) return fail("This appointment does not have a fixed online payment amount.");

  let payment = appointment.payments?.[0] ?? null;
  if (!payment) {
    const { data: createdPayment, error: paymentError } = await supabase
      .from("payments")
      .insert({
        appointment_id: appointment.id,
        business_id: appointment.business_id,
        amount,
        method: "stripe",
        status: "pending"
      })
      .select("id,amount,status")
      .single();

    if (paymentError) return safeError();
    payment = createdPayment;
  }

  const siteUrl = getSiteUrl();
  const successUrl = `${siteUrl}/book/${appointment.businesses?.slug ?? ""}?payment=success&appointment=${appointment.id}&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${siteUrl}/book/${appointment.businesses?.slug ?? ""}?payment=cancelled&appointment=${appointment.id}`;

  try {
    const session = await createStripeCheckoutSession({
      amountCents: Math.round(Number(amount) * 100),
      appointmentId: appointment.id,
      businessName: appointment.businesses?.name ?? "BookNest",
      cancelUrl,
      clientEmail: appointment.client_email,
      paymentId: payment.id,
      serviceName: appointment.services?.name ?? "Appointment",
      successUrl
    });

    await supabase
      .from("payments")
      .update({
        amount,
        method: "stripe",
        status: "pending",
        provider: "stripe",
        provider_checkout_session_id: session.id,
        provider_checkout_url: session.url,
        provider_currency: "usd"
      })
      .eq("id", payment.id);

    await supabase
      .from("appointments")
      .update({ payment_status: "pending", status: "pending_confirmation" })
      .eq("id", appointment.id);

    return ok({ checkoutUrl: session.url, sessionId: session.id });
  } catch (checkoutError) {
    return fail("Stripe checkout could not be created.", 500);
  }
}
