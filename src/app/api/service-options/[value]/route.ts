import { fail, ok, requireOwnedBusiness, requireUser } from "@/lib/api";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { serviceOptionSchema } from "@/lib/validators";

type RouteContext = { params: Promise<{ value: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { value } = await context.params;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("service_options")
    .select("*")
    .eq("service_id", value)
    .eq("is_active", true)
    .order("display_order", { ascending: true });
  if (error) return fail(error.message, 500);
  return ok({ options: data ?? [] });
}

export async function PUT(request: Request, context: RouteContext) {
  const { value } = await context.params;
  const { supabase, response } = await requireUser();
  if (response) return response;

  const parsed = serviceOptionSchema.partial().safeParse(await request.json());
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid option.");

  const ownership = await requireOwnedBusiness(supabase, parsed.data.business_id);
  if (ownership.response) return ownership.response;

  if (parsed.data.service_id) {
    const { data: service, error: serviceError } = await supabase
      .from("services")
      .select("id")
      .eq("id", parsed.data.service_id)
      .eq("business_id", ownership.business.id)
      .maybeSingle();
    if (serviceError) return fail("Service could not be verified.", 500);
    if (!service) return fail("Service does not belong to this business.", 403);
  }

  const { data, error } = await supabase.from("service_options").update(parsed.data).eq("id", value).eq("business_id", ownership.business.id).select("*").single();
  if (error) return fail(error.message, 500);
  return ok({ option: data });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { value } = await context.params;
  const { supabase, response } = await requireUser();
  if (response) return response;

  const ownership = await requireOwnedBusiness(supabase);
  if (ownership.response) return ownership.response;

  const { error } = await supabase.from("service_options").delete().eq("id", value).eq("business_id", ownership.business.id);
  if (error?.code === "23503") return fail("This option has appointment history. Make it inactive instead of deleting it.", 409);
  if (error) return fail(error.message, 500);
  return ok({ success: true });
}
