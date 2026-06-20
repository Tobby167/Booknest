import { fail, ok, requireOwnedBusiness, requireUser } from "@/lib/api";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { availabilitySchema } from "@/lib/validators";

type RouteContext = { params: Promise<{ value: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { value } = await context.params;
  const supabase = await createSupabaseServerClient();
  const { data: business } = await supabase.from("businesses").select("id").eq("slug", value).maybeSingle();
  if (!business) return fail("Business not found.", 404);

  const { data, error } = await supabase
    .from("availability")
    .select("*")
    .eq("business_id", business.id)
    .order("day_of_week", { ascending: true });
  if (error) return fail(error.message, 500);
  return ok({ availability: data ?? [] });
}

export async function PUT(request: Request, context: RouteContext) {
  const { value } = await context.params;
  const { supabase, response } = await requireUser();
  if (response) return response;

  const parsed = availabilitySchema.partial().safeParse(await request.json());
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid availability.");

  const ownership = await requireOwnedBusiness(supabase, parsed.data.business_id);
  if (ownership.response) return ownership.response;

  const { data, error } = await supabase.from("availability").update(parsed.data).eq("id", value).eq("business_id", ownership.business.id).select("*").single();
  if (error) return fail(error.message, 500);
  return ok({ availability: data });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { value } = await context.params;
  const { supabase, response } = await requireUser();
  if (response) return response;

  const ownership = await requireOwnedBusiness(supabase);
  if (ownership.response) return ownership.response;

  const { error } = await supabase.from("availability").delete().eq("id", value).eq("business_id", ownership.business.id);
  if (error) return fail(error.message, 500);
  return ok({ success: true });
}
