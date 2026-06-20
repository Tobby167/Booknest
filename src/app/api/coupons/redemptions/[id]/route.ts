import { z } from "zod";
import { fail, ok, requireOwnedBusiness, requireUser, safeError } from "@/lib/api";

type RouteContext = { params: Promise<{ id: string }> };

const redemptionStatusSchema = z.object({
  status: z.enum(["applied", "rejected"])
});

export async function PUT(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const { supabase, response } = await requireUser();
  if (response) return response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid request body.");
  }

  const parsed = redemptionStatusSchema.safeParse(body);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid coupon redemption status.");

  const ownership = await requireOwnedBusiness(supabase);
  if (ownership.response) return ownership.response;

  const { data: redemption, error: redemptionError } = await supabase
    .from("coupon_redemptions")
    .select("id,business_id,appointment_id,original_total,status")
    .eq("id", id)
    .eq("business_id", ownership.business.id)
    .maybeSingle();

  if (redemptionError) return safeError();
  if (!redemption) return fail("Coupon redemption not found.", 404);

  const { data, error } = await supabase
    .from("coupon_redemptions")
    .update({ status: parsed.data.status })
    .eq("id", id)
    .eq("business_id", ownership.business.id)
    .select("*")
    .single();

  if (error) return safeError();

  if (parsed.data.status === "rejected" && redemption.appointment_id) {
    await supabase
      .from("appointments")
      .update({
        total_price: redemption.original_total,
        coupon_id: null,
        coupon_code: null,
        discount_amount: 0
      })
      .eq("id", redemption.appointment_id)
      .eq("business_id", ownership.business.id);
  }

  return ok({ redemption: data });
}
