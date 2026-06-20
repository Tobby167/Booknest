import { fail, getOwnedBusiness, ok, requireUser } from "@/lib/api";

type RouteContext = { params: Promise<unknown> };

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = (await context.params) as { id: string };
  const { supabase, response } = await requireUser();
  if (response) return response;

  const business = await getOwnedBusiness(supabase);
  if (!business) return fail("Create your business profile first.", 400);

  const { error } = await supabase.from("blocked_times").delete().eq("id", id).eq("business_id", business.id);
  if (error) return fail(error.message, 500);
  return ok({ success: true });
}
