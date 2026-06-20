import { fail, ok } from "@/lib/api";
import { validateCoupon } from "@/lib/coupons";
import { getRequestKey, rateLimit } from "@/lib/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { couponValidateSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const limit = rateLimit(getRequestKey(request, "coupon-validate"), 20, 60_000);
  if (!limit.allowed) return fail("Too many coupon checks. Please wait a moment and try again.", 429);

  let admin;
  const supabase = await createSupabaseServerClient();
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return fail("Coupon validation is not configured on the server.", 500);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid request body.");
  }

  const parsed = couponValidateSchema.safeParse(body);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid coupon.");

  const {
    data: { user }
  } = await supabase.auth.getUser();
  const clientAuthUserId = user?.id ?? null;

  const result = await validateCoupon({
    supabase: admin,
    businessSlug: parsed.data.businessSlug,
    code: parsed.data.code,
    totalPrice: parsed.data.totalPrice,
    serviceId: parsed.data.serviceId || null,
    serviceOptionId: parsed.data.serviceOptionId || null,
    clientName: parsed.data.clientName,
    clientEmail: parsed.data.clientEmail,
    clientPhone: parsed.data.clientPhone,
    clientAuthUserId
  });

  if (!result.valid) return fail(result.message, 409);

  return ok({
    coupon: {
      id: result.coupon.id,
      code: result.coupon.code,
      name: result.coupon.name,
      discount_type: result.coupon.discount_type,
      discount_value: result.coupon.discount_value
    },
    discountAmount: result.discountAmount,
    finalTotal: result.finalTotal,
    status: result.status,
    message: result.message
  });
}
