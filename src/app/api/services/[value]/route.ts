import { fail, ok, requireOwnedBusiness, requireUser } from "@/lib/api";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { serviceSchema } from "@/lib/validators";

type RouteContext = { params: Promise<{ value: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { value } = await context.params;
  const supabase = await createSupabaseServerClient();
  const { data: business } = await supabase.from("businesses").select("id").eq("slug", value).maybeSingle();
  if (!business) return fail("Business not found.", 404);

  const { data, error } = await supabase
    .from("services")
    .select("*")
    .eq("business_id", business.id)
    .eq("is_active", true)
    .order("display_order", { ascending: true });
  if (error) return fail(error.message, 500);
  return ok({ services: data ?? [] });
}

export async function PUT(request: Request, context: RouteContext) {
  const { value } = await context.params;
  const { supabase, response } = await requireUser();
  if (response) return response;

  const parsed = serviceSchema.partial().safeParse(await request.json());
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid service.");

  const ownership = await requireOwnedBusiness(supabase, parsed.data.business_id);
  if (ownership.response) return ownership.response;

  if (parsed.data.category_id) {
    const { data: category, error: categoryError } = await supabase
      .from("service_categories")
      .select("id")
      .eq("id", parsed.data.category_id)
      .eq("business_id", ownership.business.id)
      .maybeSingle();
    if (categoryError) return fail("Category could not be verified.", 500);
    if (!category) return fail("Category does not belong to this business.", 403);
  }

  const { data, error } = await supabase.from("services").update(parsed.data).eq("id", value).eq("business_id", ownership.business.id).select("*").single();
  if (error) return fail(error.message, 500);
  return ok({ service: data });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { value } = await context.params;
  const { supabase, response } = await requireUser();
  if (response) return response;

  const ownership = await requireOwnedBusiness(supabase);
  if (ownership.response) return ownership.response;

  const { error } = await supabase.from("services").delete().eq("id", value).eq("business_id", ownership.business.id);
  if (error?.code === "23503") return fail("This service has appointment history. Make it inactive instead of deleting it.", 409);
  if (error) return fail(error.message, 500);
  return ok({ success: true });
}
