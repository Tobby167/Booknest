import { fail, getOwnedBusiness, ok, requireOwnedBusiness, requireUser } from "@/lib/api";
import { couponSchema } from "@/lib/validators";

type CouponPayload = {
  business_id: string;
  service_id?: string | null;
  service_option_id?: string | null;
  code: string;
  name: string;
  description?: string | null;
  discount_type: "percent" | "fixed";
  discount_value: number;
  audience: "everyone" | "new_clients" | "models" | "special_people" | "client_group";
  target_client_group_id?: string | null;
  requires_login: boolean;
  requires_owner_approval: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
  max_redemptions?: number | null;
  max_redemptions_per_client: number;
  is_active: boolean;
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

export async function GET() {
  const { supabase, response } = await requireUser();
  if (response) return response;

  const business = await getOwnedBusiness(supabase);
  if (!business) return ok({ business: null, coupons: [], groups: [] });

  const [coupons, groups, services, options] = await Promise.all([
    supabase
      .from("coupons")
      .select("*, coupon_redemptions(id,appointment_id,client_name,client_email,client_phone,original_total,discount_amount,final_total,status,created_at)")
      .eq("business_id", business.id)
      .order("created_at", { ascending: false }),
    supabase.from("client_groups").select("*").eq("business_id", business.id).order("name"),
    supabase.from("services").select("id,name").eq("business_id", business.id).eq("is_active", true).order("display_order"),
    supabase.from("service_options").select("id,service_id,name").eq("business_id", business.id).eq("is_active", true).order("display_order")
  ]);
  if (coupons.error) return fail(coupons.error.message, 500);
  if (groups.error) return ok({ business, coupons: coupons.data ?? [], groups: [], services: services.data ?? [], options: options.data ?? [] });

  return ok({ business, coupons: coupons.data ?? [], groups: groups.data ?? [], services: services.data ?? [], options: options.data ?? [] });
}

export async function POST(request: Request) {
  const { supabase, response } = await requireUser();
  if (response) return response;

  const parsed = couponSchema.safeParse(await request.json());
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid coupon.");

  const ownership = await requireOwnedBusiness(supabase, parsed.data.business_id);
  if (ownership.response) return ownership.response;

  const { data, error } = await supabase
    .from("coupons")
    .insert(cleanCouponPayload(parsed.data))
    .select("*")
    .single();
  if (error) return fail(error.message, 500);

  return ok({ coupon: data }, { status: 201 });
}
