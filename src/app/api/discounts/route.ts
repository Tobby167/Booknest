import { fail, getOwnedBusiness, ok, requireOwnedBusiness, requireUser, safeError } from "@/lib/api";
import { serviceDiscountSchema } from "@/lib/validators";

type ServiceDiscountPayload = {
  business_id: string;
  service_id: string;
  service_option_id?: string | null;
  name: string;
  description?: string | null;
  discount_type: "percent" | "fixed" | "special_price";
  discount_value: number;
  audience: "everyone" | "new_clients" | "models" | "special_people" | "client_group";
  target_client_group_id?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  max_redemptions?: number | null;
  is_active: boolean;
};

function cleanDiscountPayload(data: ServiceDiscountPayload) {
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

export async function GET() {
  const { supabase, response } = await requireUser();
  if (response) return response;

  const business = await getOwnedBusiness(supabase);
  if (!business) return ok({ business: null, discounts: [], services: [], options: [], groups: [] });

  const [discounts, services, options, groups] = await Promise.all([
    supabase
      .from("service_discounts")
      .select("*, service_discount_redemptions(id,client_name,client_email,client_phone,original_total,discount_amount,final_total,created_at)")
      .eq("business_id", business.id)
      .order("created_at", { ascending: false }),
    supabase.from("services").select("id,name").eq("business_id", business.id).order("display_order"),
    supabase.from("service_options").select("id,service_id,name").eq("business_id", business.id).order("display_order"),
    supabase.from("client_groups").select("*").eq("business_id", business.id).order("name")
  ]);

  if (discounts.error) return fail("Run the service discount SQL migration before using Discounts.", 500);
  if (services.error || options.error) return safeError();

  return ok({ business, discounts: discounts.data ?? [], services: services.data ?? [], options: options.data ?? [], groups: groups.error ? [] : groups.data ?? [] });
}

export async function POST(request: Request) {
  const { supabase, response } = await requireUser();
  if (response) return response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid request body.");
  }

  const parsed = serviceDiscountSchema.safeParse(body);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid discount.");

  const ownership = await requireOwnedBusiness(supabase, parsed.data.business_id);
  if (ownership.response) return ownership.response;

  const { data, error } = await supabase
    .from("service_discounts")
    .insert(cleanDiscountPayload(parsed.data))
    .select("*")
    .single();
  if (error) return safeError();

  return ok({ discount: data }, { status: 201 });
}
