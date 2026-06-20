import { fail, ok, requireOwnedBusiness, requireUser, safeError } from "@/lib/api";
import { serviceDiscountSchema } from "@/lib/validators";

type RouteContext = { params: Promise<{ id: string }> };

function cleanDiscountPayload(data: Record<string, unknown>) {
  return {
    ...data,
    service_option_id: data.service_option_id || null,
    target_client_group_id: data.audience === "client_group" ? data.target_client_group_id || null : null,
    description: data.description || null,
    starts_at: data.starts_at || null,
    ends_at: data.ends_at || null,
    max_redemptions: data.max_redemptions ?? null
  };
}

export async function PUT(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const { supabase, response } = await requireUser();
  if (response) return response;

  let json: Record<string, unknown>;
  try {
    json = await request.json();
  } catch {
    return fail("Invalid request body.");
  }

  const parsed = serviceDiscountSchema.partial().safeParse(json);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid discount.");

  const ownership = await requireOwnedBusiness(supabase, parsed.data.business_id);
  if (ownership.response) return ownership.response;

  const { data, error } = await supabase
    .from("service_discounts")
    .update({ ...cleanDiscountPayload(parsed.data), updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("business_id", ownership.business.id)
    .select("*")
    .single();
  if (error) return safeError();

  return ok({ discount: data });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const { supabase, response } = await requireUser();
  if (response) return response;

  const ownership = await requireOwnedBusiness(supabase);
  if (ownership.response) return ownership.response;

  const { error } = await supabase.from("service_discounts").delete().eq("id", id).eq("business_id", ownership.business.id);
  if (error) return safeError();

  return ok({ success: true });
}
