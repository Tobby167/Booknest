import { fail, ok } from "@/lib/api";
import { findServiceDiscount } from "@/lib/service-discounts";
import { getRequestKey, rateLimit } from "@/lib/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { serviceDiscountPreviewSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const limit = rateLimit(getRequestKey(request, "discount-preview"), 30, 60_000);
  if (!limit.allowed) return fail("Too many discount checks. Please wait a moment and try again.", 429);

  let admin;
  const supabase = await createSupabaseServerClient();
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return fail("Discount preview is not configured on the server.", 500);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid request body.");
  }

  const parsed = serviceDiscountPreviewSchema.safeParse(body);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid discount preview.");

  const {
    data: { user }
  } = await supabase.auth.getUser();

  const result = await findServiceDiscount({
    supabase: admin,
    businessSlug: parsed.data.businessSlug,
    serviceId: parsed.data.serviceId,
    serviceOptionId: parsed.data.serviceOptionId,
    totalPrice: parsed.data.totalPrice,
    clientName: parsed.data.clientName,
    clientEmail: parsed.data.clientEmail,
    clientPhone: parsed.data.clientPhone,
    clientAuthUserId: user?.id ?? null
  });

  if (!result.valid) return ok({ discount: null, message: result.message, reason: result.reason });

  return ok({
    discount: {
      id: result.discount.id,
      name: result.discount.name,
      discount_type: result.discount.discount_type,
      discount_value: result.discount.discount_value,
      audience: result.discount.audience
    },
    originalTotal: result.originalTotal,
    discountAmount: result.discountAmount,
    finalTotal: result.finalTotal,
    message: result.message
  });
}
