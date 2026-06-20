import { fail, getOwnedBusiness, ok, requireUser, safeError } from "@/lib/api";
import { getBookingDurationMinutes, getBookingPrice } from "@/lib/booking/availability";
import { normalizeCouponCode, validateCoupon } from "@/lib/coupons";
import { getRequestKey, rateLimit } from "@/lib/rate-limit";
import { findServiceDiscount } from "@/lib/service-discounts";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAppointmentSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const limit = rateLimit(getRequestKey(request, "appointment-create"), 8, 60_000);
  if (!limit.allowed) return fail("Too many booking attempts. Please wait a moment and try again.", 429);

  const supabase = await createSupabaseServerClient();
  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return fail("Booking is not configured on the server.", 500);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid request body.");
  }

  const parsed = createAppointmentSchema.safeParse(body);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid appointment.");

  const {
    data: { user: currentUser }
  } = await supabase.auth.getUser();
  const { data: currentProfile } = currentUser
    ? await supabase.from("profiles").select("role,full_name,email").eq("id", currentUser.id).maybeSingle()
    : { data: null };
  const hasClientContext = Boolean(currentUser);

  const { data: businessForRules, error: businessError } = await supabase
    .from("businesses")
    .select("id,booking_notice_hours,max_advance_booking_days")
    .eq("slug", parsed.data.businessSlug)
    .maybeSingle();
  if (businessError) return safeError();
  if (!businessForRules) return fail("Business not found.", 404);

  const requestedStart = new Date(`${parsed.data.appointmentDate}T${parsed.data.startTime}`);
  const now = new Date();
  const earliest = new Date(now.getTime() + Number(businessForRules.booking_notice_hours ?? 0) * 60 * 60 * 1000);
  const maxDate = new Date(now);
  maxDate.setDate(maxDate.getDate() + Number(businessForRules.max_advance_booking_days ?? 90));
  maxDate.setHours(23, 59, 59, 999);

  if (requestedStart <= earliest) {
    return fail(`This business requires at least ${businessForRules.booking_notice_hours ?? 0} hours notice before booking.`, 409);
  }

  if (requestedStart > maxDate) {
    return fail(`This business only accepts bookings up to ${businessForRules.max_advance_booking_days ?? 90} days in advance.`, 409);
  }

  const couponCode = normalizeCouponCode(parsed.data.couponCode);
  let selectedDuration = 60;
  let selectedTotalPrice: number | null = null;
  let selectedService: any = null;
  let selectedOption: any = null;
  let selectedAddons: any[] = [];

  const [serviceResult, optionResult, addonsResult] = await Promise.all([
    admin.from("services").select("*").eq("id", parsed.data.serviceId).eq("business_id", businessForRules.id).eq("is_active", true).maybeSingle(),
    parsed.data.serviceOptionId
      ? admin.from("service_options").select("*").eq("id", parsed.data.serviceOptionId).eq("service_id", parsed.data.serviceId).eq("is_active", true).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    parsed.data.addonIds.length
      ? admin.from("service_addons").select("*").in("id", parsed.data.addonIds).eq("service_id", parsed.data.serviceId).eq("is_active", true)
      : Promise.resolve({ data: [], error: null })
  ]);

  if (serviceResult.error || optionResult.error || addonsResult.error || !serviceResult.data) return safeError();
  selectedService = serviceResult.data;
  selectedOption = optionResult.data;
  selectedAddons = addonsResult.data ?? [];
  selectedDuration = getBookingDurationMinutes(selectedService, selectedOption, selectedAddons);
  selectedTotalPrice = getBookingPrice(selectedService, selectedOption, selectedAddons);

  const appliedServiceDiscount = await findServiceDiscount({
    supabase: admin,
    businessSlug: parsed.data.businessSlug,
    serviceId: parsed.data.serviceId,
    serviceOptionId: parsed.data.serviceOptionId || null,
    totalPrice: selectedTotalPrice,
    clientName: parsed.data.clientName,
    clientEmail: parsed.data.clientEmail,
    clientPhone: parsed.data.clientPhone,
    clientAuthUserId: currentUser?.id ?? null
  });
  const priceAfterServiceDiscount = appliedServiceDiscount.valid ? appliedServiceDiscount.finalTotal : selectedTotalPrice;

  let validatedCoupon: Awaited<ReturnType<typeof validateCoupon>> | null = null;
  if (couponCode) {
    validatedCoupon = await validateCoupon({
      supabase: admin,
      businessSlug: parsed.data.businessSlug,
      code: couponCode,
      totalPrice: priceAfterServiceDiscount,
      serviceId: parsed.data.serviceId,
      serviceOptionId: parsed.data.serviceOptionId || null,
      clientName: parsed.data.clientName,
      clientEmail: parsed.data.clientEmail,
      clientPhone: parsed.data.clientPhone,
      clientAuthUserId: currentUser?.id ?? null
    });

    if (!validatedCoupon.valid) return fail(validatedCoupon.message, 409);
  }

  if (currentUser) {
    const requestedEnd = new Date(requestedStart.getTime() + selectedDuration * 60 * 1000);

    const { data: clientAppointments, error: clientConflictError } = await admin
      .from("appointments")
      .select("id,appointment_date,start_time,end_time,status,businesses(name)")
      .eq("client_auth_user_id", currentUser.id)
      .eq("appointment_date", parsed.data.appointmentDate)
      .in("status", ["pending", "pending_confirmation", "confirmed", "rescheduled"]);
    if (clientConflictError) return safeError();

    const conflict = (clientAppointments ?? []).find((appointment) => {
      const existingStart = new Date(`${appointment.appointment_date}T${appointment.start_time}`);
      const existingEnd = new Date(`${appointment.appointment_date}T${appointment.end_time}`);
      return requestedStart < existingEnd && requestedEnd > existingStart;
    });

    if (conflict) {
      return fail("You already have a BookNest appointment during this time. Choose another time so your bookings do not overlap.", 409);
    }
  }

  const { data, error } = await admin.rpc("create_public_booking", {
    p_business_slug: parsed.data.businessSlug,
    p_service_id: parsed.data.serviceId,
    p_service_option_id: parsed.data.serviceOptionId || null,
    p_addon_ids: parsed.data.addonIds,
    p_appointment_date: parsed.data.appointmentDate,
    p_start_time: parsed.data.startTime,
    p_client_name: parsed.data.clientName,
    p_client_email: parsed.data.clientEmail || null,
    p_client_phone: parsed.data.clientPhone || null,
    p_notes: parsed.data.notes || null,
    p_receipt_image_url: parsed.data.receiptImageUrl || null,
    p_form_answers: parsed.data.formAnswers
  });

  if (error) return fail("That appointment time is not available. Please choose another time.", 409);

  let booking = data as Record<string, unknown>;
  if (currentUser) {
    const appointmentId = String(booking.appointment_id || "");
    if (appointmentId) {
      const clientEmail = (parsed.data.clientEmail || currentProfile?.email || currentUser.email || "").trim().toLowerCase();
      const clientName = (parsed.data.clientName || currentProfile?.full_name || "").trim();
      const clientPhone = (parsed.data.clientPhone || "").trim();

      const { data: clientRow } = await admin
        .from("clients")
        .select("id")
        .eq("business_id", businessForRules.id)
        .eq("auth_user_id", currentUser.id)
        .maybeSingle();

      let linkedClientId = clientRow?.id ?? null;
      if (!linkedClientId) {
        const { data: insertedClient } = await admin
          .from("clients")
          .insert({
            business_id: businessForRules.id,
            auth_user_id: currentUser.id,
            name: clientName,
            email: clientEmail || null,
            phone: clientPhone || null,
            client_type: "regular",
            is_approved: false
          })
          .select("id")
          .single();
        linkedClientId = insertedClient?.id ?? null;
      } else {
        await admin
          .from("clients")
          .update({
            name: clientName,
            email: clientEmail || null,
            phone: clientPhone || null
          })
          .eq("id", linkedClientId)
          .eq("business_id", businessForRules.id);
      }

      await admin
        .from("appointments")
        .update({
          client_auth_user_id: currentUser.id,
          client_id: linkedClientId
        })
        .eq("id", appointmentId)
        .eq("business_id", businessForRules.id);

      booking = { ...booking, client_auth_user_id: currentUser.id, client_id: linkedClientId };
    }
  }

  if (appliedServiceDiscount.valid) {
    const appointmentId = String(booking.appointment_id || "");
    const businessId = String(businessForRules.id || "");
    if (appointmentId && businessId) {
      await admin
        .from("appointments")
        .update({
          original_total_price: appliedServiceDiscount.originalTotal,
          total_price: appliedServiceDiscount.finalTotal,
          service_discount_id: appliedServiceDiscount.discount.id,
          service_discount_name: appliedServiceDiscount.discount.name,
          service_discount_amount: appliedServiceDiscount.discountAmount
        })
        .eq("id", appointmentId)
        .eq("business_id", businessId);

      await admin.from("service_discount_redemptions").insert({
        business_id: businessId,
        service_discount_id: appliedServiceDiscount.discount.id,
        appointment_id: appointmentId,
        client_name: parsed.data.clientName,
        client_email: parsed.data.clientEmail || null,
        client_phone: parsed.data.clientPhone || null,
        client_auth_user_id: currentUser?.id ?? null,
        original_total: appliedServiceDiscount.originalTotal,
        discount_amount: appliedServiceDiscount.discountAmount,
        final_total: appliedServiceDiscount.finalTotal
      });

      booking = {
        ...booking,
        original_total_price: appliedServiceDiscount.originalTotal,
        total_price: appliedServiceDiscount.finalTotal,
        service_discount_id: appliedServiceDiscount.discount.id,
        service_discount_name: appliedServiceDiscount.discount.name,
        service_discount_amount: appliedServiceDiscount.discountAmount
      };
    }
  }

  if (couponCode && validatedCoupon?.valid) {
    const totalPrice = Number(booking.total_price ?? 0);
    const coupon = validatedCoupon;

    const appointmentId = String(booking.appointment_id || "");
    const businessId = String(businessForRules.id || "");
    if (appointmentId && businessId) {
      await admin
        .from("appointments")
        .update({
          total_price: coupon.finalTotal,
          coupon_id: coupon.coupon.id,
          coupon_code: coupon.coupon.code,
          discount_amount: coupon.discountAmount
        })
        .eq("id", appointmentId)
        .eq("business_id", businessId);

      await admin.from("coupon_redemptions").insert({
        business_id: businessId,
        coupon_id: coupon.coupon.id,
        appointment_id: appointmentId,
        client_name: parsed.data.clientName,
        client_email: parsed.data.clientEmail || null,
        client_phone: parsed.data.clientPhone || null,
        client_auth_user_id: currentUser?.id ?? null,
        original_total: totalPrice,
        discount_amount: coupon.discountAmount,
        final_total: coupon.finalTotal,
        status: coupon.status
      });

      booking = {
        ...booking,
        total_price: coupon.finalTotal,
        coupon_id: coupon.coupon.id,
        coupon_code: coupon.coupon.code,
        discount_amount: coupon.discountAmount
      };
    }
  }
  return ok({ booking }, { status: 201 });
}

export async function GET() {
  const { supabase, response } = await requireUser();
  if (response) return response;

  const business = await getOwnedBusiness(supabase);
  if (!business) return ok({ appointments: [] });

  const { data, error } = await supabase
    .from("appointments")
    .select("*, services(name), service_options(name), payments(*)")
    .eq("business_id", business.id)
    .order("appointment_date", { ascending: true })
    .order("start_time", { ascending: true });
  if (error) return safeError();
  return ok({ appointments: data ?? [] });
}
