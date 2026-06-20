import { fail, ok, requireOwnedBusiness, requireUser } from "@/lib/api";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const { supabase, response } = await requireUser();
  if (response) return response;

  const ownership = await requireOwnedBusiness(supabase);
  if (ownership.response) return ownership.response;

  const { data, error } = await supabase
    .from("appointments")
    .select("*, services(*), service_options(*), appointment_addons(*), payments(*)")
    .eq("id", id)
    .eq("business_id", ownership.business.id)
    .single();
  if (error) return fail(error.message, 404);
  return ok({ appointment: data });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const { supabase, response } = await requireUser();
  if (response) return response;

  const ownership = await requireOwnedBusiness(supabase);
  if (ownership.response) return ownership.response;

  const { error } = await supabase.from("appointments").update({ status: "cancelled" }).eq("id", id).eq("business_id", ownership.business.id);
  if (error) return fail(error.message, 500);
  return ok({ success: true });
}
