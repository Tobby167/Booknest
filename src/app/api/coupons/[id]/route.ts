import { fail, ok, requireOwnedBusiness, requireUser } from "@/lib/api";
import { couponSchema } from "@/lib/validators";

type RouteContext = { params: Promise<{ id: string }> };

type CouponPayload = {
  business_id?: string;
  service_id?: string | null;
  service_option_id?: string | null;
  code?: string;
  name?: string;
  description?: string | null;
  discount_type?: "percent" | "fixed";
  discount_value?: number;
  audience?: "everyone" | "new_clients" | "models" | "special_people" | "client_group";
  target_client_group_id?: string | null;
  requires_login?: boolean;
  requires_owner_approval?: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
  max_redemptions?: number | null;
  max_redemptions_per_client?: number;
  is_active?: boolean;
};

function cleanCouponPayload(data: CouponPayload) {
  return {
    ...data,
    description: data.description || null,
    service_id: data.service_id || null,
    service_option_id: data.service_id ? data.service_option_id || null : null,
    target_client_group_id: data.audience === "client_group" ? data.target_client_group_id || null : null,
    starts_at: data.starts_at || null,
    ends_at: data.ends_at || null,
    max_redemptions: data.max_redemptions ?? null
  };
}

export async function PUT(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const { supabase, response } = await requireUser();
  if (response) return response;

  const json = await request.json();
  const parsed = couponSchema.partial().safeParse({
    ...json,
    code: json.code ? String(json.code).trim().toUpperCase() : undefined
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid coupon.");

  const ownership = await requireOwnedBusiness(supabase, parsed.data.business_id);
  if (ownership.response) return ownership.response;

  const { data, error } = await supabase
    .from("coupons")
    .update({ ...cleanCouponPayload(parsed.data), updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("business_id", ownership.business.id)
    .select("*")
    .single();
  if (error) return fail(error.message, 500);

  return ok({ coupon: data });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const { supabase, response } = await requireUser();
  if (response) return response;

  const ownership = await requireOwnedBusiness(supabase);
  if (ownership.response) return ownership.response;

  const { error } = await supabase.from("coupons").delete().eq("id", id).eq("business_id", ownership.business.id);
  if (error) return fail(error.message, 500);

  return ok({ success: true });
}
