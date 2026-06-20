import { fail, ok, requireUser } from "@/lib/api";
import { getReminderAppointments } from "@/lib/reminders";

export async function GET() {
  const { supabase, response } = await requireUser();
  if (response) return response;

  const { data, error } = await getReminderAppointments(supabase, "pending-confirmations");
  if (error) return fail(error.message, 500);
  return ok({ appointments: data ?? [] });
}
