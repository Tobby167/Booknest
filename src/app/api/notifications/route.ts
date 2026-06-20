import { fail, getOwnedBusiness, ok, requireUser } from "@/lib/api";

export async function GET(request: Request) {
  const { supabase, response } = await requireUser();
  if (response) return response;

  const unreadOnly = new URL(request.url).searchParams.get("unread") === "true";
  const business = await getOwnedBusiness(supabase);
  if (!business) return ok({ notifications: [] });

  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  const soon = new Date();
  soon.setDate(today.getDate() + 3);
  const todayIso = today.toISOString().slice(0, 10);
  const tomorrowIso = tomorrow.toISOString().slice(0, 10);
  const soonIso = soon.toISOString().slice(0, 10);

  const { data: upcoming } = await supabase
    .from("appointments")
    .select("id, client_name, appointment_date, start_time")
    .eq("business_id", business.id)
    .gte("appointment_date", todayIso)
    .lte("appointment_date", soonIso)
    .in("status", ["pending", "pending_confirmation", "confirmed"]);

  if (upcoming?.length) {
    const { data: existing } = await supabase
      .from("notifications")
      .select("appointment_id, type")
      .eq("business_id", business.id)
      .in("type", ["appointment_today", "appointment_tomorrow", "appointment_soon"]);

    const existingKeys = new Set((existing ?? []).map((item) => `${item.appointment_id}:${item.type}`));
    const drafts = upcoming
      .map((appointment) => {
        const type =
          appointment.appointment_date === todayIso
            ? "appointment_today"
            : appointment.appointment_date === tomorrowIso
              ? "appointment_tomorrow"
              : "appointment_soon";
        return {
          business_id: business.id,
          user_id: business.owner_id,
          appointment_id: appointment.id,
          type,
          title: type === "appointment_today" ? "Appointment today" : type === "appointment_tomorrow" ? "Appointment tomorrow" : "Appointment coming up soon",
          message: `${appointment.client_name} is booked for ${appointment.appointment_date} at ${appointment.start_time}.`
        };
      })
      .filter((draft) => !existingKeys.has(`${draft.appointment_id}:${draft.type}`));

    if (drafts.length) await supabase.from("notifications").insert(drafts);
  }

  let query = supabase
    .from("notifications")
    .select("*")
    .eq("business_id", business.id)
    .order("created_at", { ascending: false });
  if (unreadOnly) query = query.eq("is_read", false);

  const { data, error } = await query;
  if (error) return fail(error.message, 500);
  return ok({ notifications: data ?? [] });
}
