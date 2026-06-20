import { fail, ok, safeError } from "@/lib/api";
import { generateAvailableSlots } from "@/lib/booking/availability";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ServiceAddon } from "@/lib/types";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const businessSlug = searchParams.get("businessSlug");
  const serviceId = searchParams.get("serviceId");
  const serviceOptionId = searchParams.get("serviceOptionId");
  const date = searchParams.get("date");
  const addonIds = searchParams.get("addonIds")?.split(",").filter(Boolean) ?? [];

  if (!businessSlug || !serviceId || !date) return fail("businessSlug, serviceId, and date are required.");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(businessSlug)) return fail("Invalid business slug.");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(serviceId)) return fail("Invalid service.");
  if (serviceOptionId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(serviceOptionId)) return fail("Invalid service option.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail("Invalid date.");
  if (addonIds.some((id) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))) return fail("Invalid add-on.");

  const supabase = await createSupabaseServerClient();
  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return fail("Availability lookup is not configured on the server.", 500);
  }

  const { data: business } = await supabase.from("businesses").select("*").eq("slug", businessSlug).maybeSingle();
  if (!business) return fail("Business not found.", 404);

  const [serviceResult, optionResult, addonsResult, availabilityResult, blockedResult, blockedTimeResult, bookedResult] = await Promise.all([
    supabase.from("services").select("*").eq("id", serviceId).eq("business_id", business.id).eq("is_active", true).maybeSingle(),
    serviceOptionId
      ? supabase.from("service_options").select("*").eq("id", serviceOptionId).eq("service_id", serviceId).eq("is_active", true).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    addonIds.length
      ? supabase.from("service_addons").select("*").in("id", addonIds).eq("service_id", serviceId).eq("is_active", true)
      : Promise.resolve({ data: [] as ServiceAddon[], error: null }),
    supabase.from("availability").select("*").eq("business_id", business.id),
    admin.from("blocked_dates").select("id,business_id,date").eq("business_id", business.id),
    admin.from("blocked_times").select("id,business_id,date,start_time,end_time").eq("business_id", business.id).eq("date", date),
    admin.rpc("get_booked_appointment_ranges", { p_business_slug: businessSlug, p_date: date })
  ]);

  if (serviceResult.error) return safeError();
  if (!serviceResult.data) return fail("Service not found.", 404);
  if (optionResult.error) return safeError();
  if (addonsResult.error) return safeError();
  if (availabilityResult.error) return safeError();
  if (blockedResult.error) return safeError();
  if (blockedTimeResult.error) return safeError();
  if (bookedResult.error) return safeError();

  const slots = generateAvailableSlots({
    date,
    service: serviceResult.data,
    option: optionResult.data,
    addons: addonsResult.data ?? [],
    availability: availabilityResult.data ?? [],
    blockedDates: blockedResult.data ?? [],
    blockedTimes: blockedTimeResult.data ?? [],
    bookedRanges: bookedResult.data ?? [],
    bookingNoticeHours: business.booking_notice_hours ?? 0,
    maxAdvanceBookingDays: business.max_advance_booking_days ?? 90,
    defaultBufferAfterMinutes: business.default_buffer_after_minutes ?? 0
  });

  return ok({ slots });
}
