type CheckoutInput = {
  amountCents: number;
  appointmentId: string;
  businessName: string;
  cancelUrl: string;
  clientEmail?: string | null;
  currency?: string;
  paymentId: string;
  serviceName: string;
  successUrl: string;
};

type StripeSession = {
  id: string;
  url: string | null;
};

export function isStripeCheckoutConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export async function createStripeCheckoutSession(input: CheckoutInput) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error("Stripe checkout is not configured.");

  const params = new URLSearchParams();
  params.set("mode", "payment");
  params.set("success_url", input.successUrl);
  params.set("cancel_url", input.cancelUrl);
  params.set("line_items[0][quantity]", "1");
  params.set("line_items[0][price_data][currency]", input.currency ?? "usd");
  params.set("line_items[0][price_data][unit_amount]", String(input.amountCents));
  params.set("line_items[0][price_data][product_data][name]", `${input.businessName} - ${input.serviceName}`);
  params.set("metadata[appointment_id]", input.appointmentId);
  params.set("metadata[payment_id]", input.paymentId);
  if (input.clientEmail) params.set("customer_email", input.clientEmail);

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: params
  });

  const data = (await response.json()) as StripeSession & { error?: { message?: string } };
  if (!response.ok) throw new Error(data.error?.message || "Stripe checkout session could not be created.");
  if (!data.url) throw new Error("Stripe did not return a checkout URL.");
  return data;
}
