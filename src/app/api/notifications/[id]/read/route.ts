import { fail, ok, requireOwnedBusiness, requireUser } from "@/lib/api";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const { supabase, response } = await requireUser();
  if (response) return response;

  const ownership = await requireOwnedBusiness(supabase);
  if (ownership.response) return ownership.response;

  const { data, error } = await supabase.from("notifications").update({ is_read: true }).eq("id", id).eq("business_id", ownership.business.id).select("*").single();
  if (error) return fail(error.message, 500);
  return ok({ notification: data });
}
