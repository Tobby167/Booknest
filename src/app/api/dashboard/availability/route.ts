import { fail, getOwnedBusiness, ok, requireUser } from "@/lib/api";

export async function GET() {
  const { supabase, response } = await requireUser();
  if (response) return response;

  const business = await getOwnedBusiness(supabase);
  if (!business) return ok({ business: null, availability: [], blockedDates: [], blockedTimes: [] });

  const [availability, blockedDates, blockedTimes] = await Promise.all([
    supabase.from("availability").select("*").eq("business_id", business.id).order("day_of_week"),
    supabase.from("blocked_dates").select("*").eq("business_id", business.id).order("date"),
    supabase.from("blocked_times").select("*").eq("business_id", business.id).order("date").order("start_time")
  ]);

  if (availability.error) return fail(availability.error.message, 500);
  if (blockedDates.error) return fail(blockedDates.error.message, 500);
  if (blockedTimes.error) return fail(blockedTimes.error.message, 500);
  return ok({ business, availability: availability.data ?? [], blockedDates: blockedDates.data ?? [], blockedTimes: blockedTimes.data ?? [] });
}
