import type { SupabaseClient } from "@supabase/supabase-js";

type ServiceDiscountRow = {
  id: string;
  business_id: string;
  service_id: string;
  service_option_id: string | null;
  name: string;
  description: string | null;
  discount_type: "percent" | "fixed" | "special_price";
  discount_value: number;
  audience: "everyone" | "new_clients" | "models" | "special_people" | "client_group";
  target_client_group_id: string | null;
  starts_at: string | null;
  ends_at: string | null;
  max_redemptions: number | null;
  is_active: boolean;
};

export type ServiceDiscountResult =
  | {
      valid: true;
      discount: ServiceDiscountRow;
      discountAmount: number;
      finalTotal: number;
      originalTotal: number;
      message: string;
    }
  | { valid: false; message: string; reason: "none" | "not_eligible" | "invalid_total" };

function cleanEmail(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

function cleanPhone(value?: string | null) {
  return String(value || "").replace(/\D/g, "");
}

function cleanName(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

async function findBusinessClient({
  supabase,
  businessId,
  clientAuthUserId,
  clientName,
  clientEmail,
  clientPhone
}: {
  supabase: SupabaseClient;
  businessId: string;
  clientAuthUserId?: string | null;
  clientName?: string | null;
  clientEmail?: string | null;
  clientPhone?: string | null;
}) {
  if (clientAuthUserId) {
    const { data } = await supabase
      .from("clients")
      .select("id,client_type,is_approved")
      .eq("business_id", businessId)
      .eq("auth_user_id", clientAuthUserId)
      .maybeSingle();
    if (data) return data as { id: string; client_type: string; is_approved: boolean };
  }

  const email = cleanEmail(clientEmail);
  const phone = cleanPhone(clientPhone);
  const name = cleanName(clientName);
  if (!email && !phone && !name) return null;

  const { data: clients } = await supabase
    .from("clients")
    .select("id,client_type,is_approved,name,email,phone")
    .eq("business_id", businessId)
    .limit(200);

  const match = (clients ?? []).find((client) => {
    const sameEmail = email && cleanEmail(client.email) === email;
    const samePhone = phone && cleanPhone(client.phone) === phone;
    const sameName = name && cleanName(client.name) === name;
    return sameEmail || samePhone || sameName;
  });

  return match ? { id: match.id, client_type: match.client_type, is_approved: match.is_approved } : null;
}

export function calculateServiceDiscount(
  discount: Pick<ServiceDiscountRow, "discount_type" | "discount_value">,
  totalPrice: number
) {
  if (!Number.isFinite(totalPrice) || totalPrice <= 0) return 0;
  const value = Number(discount.discount_value);
  const rawDiscount =
    discount.discount_type === "percent"
      ? totalPrice * (value / 100)
      : discount.discount_type === "special_price"
        ? totalPrice - value
        : value;

  return Math.max(0, Math.min(totalPrice, Math.round(rawDiscount * 100) / 100));
}

export async function findServiceDiscount({
  supabase,
  businessSlug,
  serviceId,
  serviceOptionId,
  totalPrice,
  clientName,
  clientEmail,
  clientPhone,
  clientAuthUserId,
  ignoreAppointmentId
}: {
  supabase: SupabaseClient;
  businessSlug: string;
  serviceId: string;
  serviceOptionId?: string | null;
  totalPrice: number | null | undefined;
  clientName?: string | null;
  clientEmail?: string | null;
  clientPhone?: string | null;
  clientAuthUserId?: string | null;
  ignoreAppointmentId?: string | null;
}): Promise<ServiceDiscountResult> {
  if (totalPrice == null || !Number.isFinite(Number(totalPrice))) {
    return { valid: false, reason: "invalid_total", message: "Service discounts need a fixed booking total." };
  }

  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("id")
    .eq("slug", businessSlug)
    .maybeSingle();
  if (businessError || !business) return { valid: false, reason: "none", message: "Business not found." };
  const businessId = business.id;

  const { data: discounts, error: discountsError } = await supabase
    .from("service_discounts")
    .select("*")
    .eq("business_id", businessId)
    .eq("service_id", serviceId)
    .eq("is_active", true);

  if (discountsError) return { valid: false, reason: "none", message: "Service discounts are not configured yet." };

  const now = Date.now();
  const matchingDiscounts = ((discounts ?? []) as ServiceDiscountRow[])
    .filter((discount) => !discount.service_option_id || discount.service_option_id === serviceOptionId)
    .filter((discount) => !discount.starts_at || Date.parse(discount.starts_at) <= now)
    .filter((discount) => !discount.ends_at || Date.parse(discount.ends_at) >= now);

  if (!matchingDiscounts.length) return { valid: false, reason: "none", message: "No service discount applies." };

  const businessClient = await findBusinessClient({
    supabase,
    businessId,
    clientAuthUserId,
    clientName,
    clientEmail,
    clientPhone
  });

  const email = cleanEmail(clientEmail);
  const phone = cleanPhone(clientPhone);
  const name = cleanName(clientName);

  async function eligible(discount: ServiceDiscountRow) {
    if (discount.max_redemptions) {
      const { count } = await supabase
        .from("service_discount_redemptions")
        .select("id", { count: "exact", head: true })
        .eq("service_discount_id", discount.id);
      if ((count ?? 0) >= discount.max_redemptions) return false;
    }

    if (discount.audience === "models") {
      return Boolean(clientAuthUserId && businessClient?.client_type === "model" && businessClient.is_approved);
    }

    if (discount.audience === "special_people") {
      return Boolean(clientAuthUserId && businessClient?.is_approved && ["special_person", "vip", "model"].includes(businessClient.client_type));
    }

    if (discount.audience === "client_group") {
      if (!discount.target_client_group_id || !businessClient) return false;
      const { data: membership } = await supabase
        .from("client_group_members")
        .select("id")
        .eq("business_id", businessId)
        .eq("client_id", businessClient.id)
        .eq("client_group_id", discount.target_client_group_id)
        .maybeSingle();
      return Boolean(membership);
    }

    if (discount.audience === "new_clients") {
      if (clientAuthUserId) {
        const { count } = await supabase
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .eq("business_id", businessId)
          .eq("client_auth_user_id", clientAuthUserId)
          .neq("id", ignoreAppointmentId || "00000000-0000-0000-0000-000000000000")
          .not("status", "in", "(cancelled,no_show)");
        if ((count ?? 0) > 0) return false;
      }

      if (email || phone || name) {
        const { data: priorAppointments } = await supabase
          .from("appointments")
          .select("id,client_name,client_email,client_phone")
          .eq("business_id", businessId)
          .neq("id", ignoreAppointmentId || "00000000-0000-0000-0000-000000000000")
          .not("status", "in", "(cancelled,no_show)")
          .limit(200);
        return !(priorAppointments ?? []).some((appointment) => {
          const sameEmail = email && cleanEmail(appointment.client_email) === email;
          const samePhone = phone && cleanPhone(appointment.client_phone) === phone;
          const sameName = name && cleanName(appointment.client_name) === name;
          return sameEmail || samePhone || sameName;
        });
      }
    }

    return true;
  }

  const eligibleDiscounts: ServiceDiscountRow[] = [];
  for (const discount of matchingDiscounts) {
    if (await eligible(discount)) eligibleDiscounts.push(discount);
  }

  if (!eligibleDiscounts.length) {
    return { valid: false, reason: "not_eligible", message: "A service discount exists, but this client is not eligible." };
  }

  const total = Number(totalPrice);
  const best = eligibleDiscounts
    .map((discount) => ({
      discount,
      amount: calculateServiceDiscount(discount, total)
    }))
    .sort((left, right) => right.amount - left.amount)[0];

  if (!best || best.amount <= 0) return { valid: false, reason: "none", message: "No service discount reduces this booking." };

  return {
    valid: true,
    discount: best.discount,
    originalTotal: total,
    discountAmount: best.amount,
    finalTotal: Math.max(0, Math.round((total - best.amount) * 100) / 100),
    message: `${best.discount.name} applied.`
  };
}
