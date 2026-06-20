import type { SupabaseClient } from "@supabase/supabase-js";

type CouponRow = {
  id: string;
  business_id: string;
  service_id: string | null;
  service_option_id: string | null;
  code: string;
  name: string;
  discount_type: "percent" | "fixed";
  discount_value: number;
  audience: "everyone" | "new_clients" | "models" | "special_people" | "client_group";
  target_client_group_id: string | null;
  requires_login: boolean;
  requires_owner_approval: boolean;
  starts_at: string | null;
  ends_at: string | null;
  max_redemptions: number | null;
  max_redemptions_per_client: number;
  is_active: boolean;
};

export type CouponValidationResult =
  | {
      valid: true;
      coupon: CouponRow;
      discountAmount: number;
      finalTotal: number;
      status: "applied" | "pending_owner_approval";
      message: string;
    }
  | { valid: false; message: string };

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

export function normalizeCouponCode(code?: string | null) {
  return String(code || "").trim().toUpperCase();
}

export function calculateCouponDiscount(coupon: Pick<CouponRow, "discount_type" | "discount_value">, totalPrice: number) {
  if (!Number.isFinite(totalPrice) || totalPrice <= 0) return 0;
  const rawDiscount = coupon.discount_type === "percent" ? totalPrice * (Number(coupon.discount_value) / 100) : Number(coupon.discount_value);
  return Math.max(0, Math.min(totalPrice, Math.round(rawDiscount * 100) / 100));
}

export async function validateCoupon({
  supabase,
  businessSlug,
  code,
  totalPrice,
  clientName,
  clientEmail,
  clientPhone,
  clientAuthUserId,
  serviceId,
  serviceOptionId,
  ignoreAppointmentId
}: {
  supabase: SupabaseClient;
  businessSlug: string;
  code: string;
  totalPrice: number | null | undefined;
  serviceId?: string | null;
  serviceOptionId?: string | null;
  clientName?: string | null;
  clientEmail?: string | null;
  clientPhone?: string | null;
  clientAuthUserId?: string | null;
  ignoreAppointmentId?: string | null;
}): Promise<CouponValidationResult> {
  const normalizedCode = normalizeCouponCode(code);
  if (!normalizedCode) return { valid: false, message: "Enter a coupon code." };
  if (totalPrice == null || !Number.isFinite(Number(totalPrice))) {
    return { valid: false, message: "Coupons can only be used on bookings with a fixed total." };
  }

  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("id")
    .eq("slug", businessSlug)
    .maybeSingle();
  if (businessError || !business) return { valid: false, message: "Business not found." };

  const { data: coupon, error: couponError } = await supabase
    .from("coupons")
    .select("*")
    .eq("business_id", business.id)
    .eq("code", normalizedCode)
    .maybeSingle();
  if (couponError || !coupon) return { valid: false, message: "Coupon was not found." };

  const row = coupon as CouponRow;
  if (!row.is_active) return { valid: false, message: "This coupon is not active." };

  if (row.service_id && row.service_id !== serviceId) {
    return { valid: false, message: "This coupon is not valid for the service you selected." };
  }

  if (row.service_option_id && row.service_option_id !== serviceOptionId) {
    return { valid: false, message: "This coupon is not valid for the option you selected." };
  }

  const now = Date.now();
  if (row.starts_at && Date.parse(row.starts_at) > now) return { valid: false, message: "This coupon is not active yet." };
  if (row.ends_at && Date.parse(row.ends_at) < now) return { valid: false, message: "This coupon has expired." };
  if (row.requires_login && !clientAuthUserId) {
    return { valid: false, message: "Login as a client before using this coupon." };
  }

  const businessClient = await findBusinessClient({
    supabase,
    businessId: business.id,
    clientAuthUserId,
    clientName,
    clientEmail,
    clientPhone
  });

  if (row.audience === "models") {
    if (!clientAuthUserId) {
      return { valid: false, message: "Login before using a model coupon." };
    }
    if (!businessClient || businessClient.client_type !== "model" || !businessClient.is_approved) {
      return { valid: false, message: "This coupon is for approved models only." };
    }
  }

  if (row.audience === "special_people") {
    if (!clientAuthUserId) {
      return { valid: false, message: "Login before using a special-person coupon." };
    }
    if (!businessClient || !["special_person", "vip", "model"].includes(businessClient.client_type) || !businessClient.is_approved) {
      return { valid: false, message: "This coupon is for approved special clients only." };
    }
  }

  if (row.audience === "client_group") {
    if (!row.target_client_group_id) {
      return { valid: false, message: "This coupon is missing its client group." };
    }
    if (!businessClient) {
      return { valid: false, message: "This coupon is only for registered clients in a selected group." };
    }
    const { data: membership } = await supabase
      .from("client_group_members")
      .select("id")
      .eq("business_id", business.id)
      .eq("client_id", businessClient.id)
      .eq("client_group_id", row.target_client_group_id)
      .maybeSingle();
    if (!membership) {
      return { valid: false, message: "This coupon is only for a selected client group." };
    }
  }

  const total = Number(totalPrice);
  const discountAmount = calculateCouponDiscount(row, total);
  if (discountAmount <= 0) return { valid: false, message: "This coupon does not reduce this booking total." };

  const { count: totalUses } = await supabase
    .from("coupon_redemptions")
    .select("id", { count: "exact", head: true })
    .eq("coupon_id", row.id)
    .neq("status", "rejected");
  if (row.max_redemptions && (totalUses ?? 0) >= row.max_redemptions) {
    return { valid: false, message: "This coupon has reached its use limit." };
  }

  const email = cleanEmail(clientEmail);
  const phone = cleanPhone(clientPhone);
  const name = cleanName(clientName);
  if (email || phone || name) {
    const { data: priorUses } = await supabase
      .from("coupon_redemptions")
      .select("id,client_name,client_email,client_phone")
      .eq("business_id", business.id)
      .eq("coupon_id", row.id)
      .neq("status", "rejected")
      .limit(100);

    const matchingUses = (priorUses ?? []).filter((use) => {
      const sameEmail = email && cleanEmail(use.client_email) === email;
      const samePhone = phone && cleanPhone(use.client_phone) === phone;
      const sameName = name && cleanName(use.client_name) === name;
      return sameEmail || samePhone || sameName;
    });

    if (matchingUses.length >= row.max_redemptions_per_client) {
      return { valid: false, message: "This coupon was already used by this client." };
    }
  }

  if (clientAuthUserId) {
    const { count: userUses } = await supabase
      .from("coupon_redemptions")
      .select("id", { count: "exact", head: true })
      .eq("coupon_id", row.id)
      .eq("client_auth_user_id", clientAuthUserId)
      .neq("status", "rejected");
    if ((userUses ?? 0) >= row.max_redemptions_per_client) {
      return { valid: false, message: "This coupon was already used by your client account." };
    }
  }

  if (row.audience === "new_clients") {
    if (clientAuthUserId) {
      const { count: priorAccountBookings } = await supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("business_id", business.id)
        .eq("client_auth_user_id", clientAuthUserId)
        .neq("id", ignoreAppointmentId || "00000000-0000-0000-0000-000000000000")
        .not("status", "in", "(cancelled,no_show)");

      if ((priorAccountBookings ?? 0) > 0) return { valid: false, message: "This coupon is for new clients only." };
    }

    const { data: existingClients } = await supabase
      .from("appointments")
      .select("id,client_name,client_email,client_phone")
      .eq("business_id", business.id)
      .neq("id", ignoreAppointmentId || "00000000-0000-0000-0000-000000000000")
      .not("status", "in", "(cancelled,no_show)")
      .limit(200);
    const alreadyKnown = (existingClients ?? []).some((client) => {
      const sameEmail = email && cleanEmail(client.client_email) === email;
      const samePhone = phone && cleanPhone(client.client_phone) === phone;
      const sameName = name && cleanName(client.client_name) === name;
      return sameEmail || samePhone || sameName;
    });
    if (alreadyKnown) return { valid: false, message: "This coupon is for new clients only." };
  }

  return {
    valid: true,
    coupon: row,
    discountAmount,
    finalTotal: Math.max(0, Math.round((total - discountAmount) * 100) / 100),
    status: row.requires_owner_approval ? "pending_owner_approval" : "applied",
    message: row.requires_owner_approval ? "Coupon added. Owner will review it." : "Coupon applied."
  };
}
