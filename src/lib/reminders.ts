import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOwnedBusiness } from "@/lib/api";

export function isoDateOffset(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export async function getReminderAppointments(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  kind: "today" | "tomorrow" | "pending-confirmations" | "needs-follow-up"
) {
  const business = await getOwnedBusiness(supabase);
  if (!business) return { data: [], error: null };

  let query = supabase
    .from("appointments")
    .select("*, services(name), service_options(name), payments(*)")
    .eq("business_id", business.id)
    .order("appointment_date", { ascending: true })
    .order("start_time", { ascending: true });

  if (kind === "today") query = query.eq("appointment_date", isoDateOffset(0)).in("status", ["pending", "pending_confirmation", "confirmed"]);
  if (kind === "tomorrow") query = query.eq("appointment_date", isoDateOffset(1)).in("status", ["pending", "pending_confirmation", "confirmed"]);
  if (kind === "pending-confirmations") query = query.eq("status", "pending_confirmation");
  if (kind === "needs-follow-up") {
    query = query.or("status.eq.pending_confirmation,payment_status.eq.receipt_uploaded");
  }

  return query;
}
