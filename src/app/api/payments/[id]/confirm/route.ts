import { fail, ok, requireOwnedBusiness, requireUser } from "@/lib/api";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const { supabase, user, response } = await requireUser();
  if (response) return response;
  if (!user) return fail("Authentication required.", 401);

  const ownership = await requireOwnedBusiness(supabase);
  if (ownership.response) return ownership.response;

  const { data: payment, error } = await supabase
    .from("payments")
    .update({ status: "confirmed", confirmed_by: user.id, confirmed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("business_id", ownership.business.id)
    .select("*")
    .single();
  if (error) return fail(error.message, 500);

  await supabase.from("appointments").update({ payment_status: "confirmed" }).eq("id", payment.appointment_id).eq("business_id", ownership.business.id);
  return ok({ payment });
}
