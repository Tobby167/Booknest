import { fail, ok, requireOwnedBusiness, requireUser } from "@/lib/api";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { serviceCategorySchema } from "@/lib/validators";

type RouteContext = { params: Promise<{ value: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { value } = await context.params;
  const supabase = await createSupabaseServerClient();
  const { data: business } = await supabase.from("businesses").select("id").eq("slug", value).maybeSingle();
  if (!business) return fail("Business not found.", 404);

  const { data, error } = await supabase
    .from("service_categories")
    .select("*")
    .eq("business_id", business.id)
    .eq("is_active", true)
    .order("display_order", { ascending: true });
  if (error) return fail(error.message, 500);
  return ok({ categories: data ?? [] });
}

export async function PUT(request: Request, context: RouteContext) {
  const { value } = await context.params;
  const { supabase, response } = await requireUser();
  if (response) return response;

  const parsed = serviceCategorySchema.partial().safeParse(await request.json());
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid category.");

  const ownership = await requireOwnedBusiness(supabase, parsed.data.business_id);
  if (ownership.response) return ownership.response;

  const { data, error } = await supabase.from("service_categories").update(parsed.data).eq("id", value).eq("business_id", ownership.business.id).select("*").single();
  if (error) return fail(error.message, 500);
  return ok({ category: data });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { value } = await context.params;
  const { supabase, response } = await requireUser();
  if (response) return response;

  const ownership = await requireOwnedBusiness(supabase);
  if (ownership.response) return ownership.response;

  const { error } = await supabase.from("service_categories").delete().eq("id", value).eq("business_id", ownership.business.id);
  if (error) return fail(error.message, 500);
  return ok({ success: true });
}
