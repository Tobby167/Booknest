import { fail, ok, requireOwnedBusiness, requireUser } from "@/lib/api";
import { verifyPaymentReceipt } from "@/services/ai/paymentVerifier";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const { supabase, user, response } = await requireUser();
  if (response) return response;
  if (!user) return fail("Authentication required.", 401);

  const ownership = await requireOwnedBusiness(supabase);
  if (ownership.response) return ownership.response;

  // Verify that the payment actually belongs to this business
  const { data: payment, error: checkError } = await supabase
    .from("payments")
    .select("id")
    .eq("id", id)
    .eq("business_id", ownership.business.id)
    .maybeSingle();

  if (checkError || !payment) {
    return fail("Payment not found or access denied.", 404);
  }

  // Run AI verifier
  try {
    const result = await verifyPaymentReceipt(id);
    return ok(result);
  } catch (err: any) {
    return fail(err.message || "Failed to execute AI verification.", 500);
  }
}
