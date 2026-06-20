import { fail, ok, requireOwnedBusiness, requireUser } from "@/lib/api";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string }> };

const rescheduleSchema = z.object({
  appointment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_time: z.string().regex(/^\d{2}:\d{2}/),
  end_time: z.string().regex(/^\d{2}:\d{2}/)
});

type AppointmentForConflict = {
  id: string;
  business_id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  service_id: string | null;
  services?: {
    buffer_before_minutes: number | null;
    buffer_after_minutes: number | null;
  } | null;
};

function timeToMinutes(time: string) {
  const [hoursRaw = "0", minutesRaw = "0"] = time.split(":");
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);
  return hours * 60 + minutes;
}

function rangeConflicts(leftStart: number, leftEnd: number, rightStart: number, rightEnd: number) {
  return leftStart < rightEnd && leftEnd > rightStart;
}

export async function PUT(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const { supabase, response } = await requireUser();
  if (response) return response;

  const ownership = await requireOwnedBusiness(supabase);
  if (ownership.response) return ownership.response;

  const parsed = rescheduleSchema.safeParse(await request.json());
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid reschedule request.");

  const { data: appointment, error: currentError } = await supabase
    .from("appointments")
    .select("*, services(buffer_before_minutes, buffer_after_minutes)")
    .eq("id", id)
    .eq("business_id", ownership.business.id)
    .single<AppointmentForConflict>();
  if (currentError) return fail(currentError.message, 404);

  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("default_buffer_after_minutes")
    .eq("id", appointment.business_id)
    .single<{ default_buffer_after_minutes: number | null }>();
  if (businessError) return fail(businessError.message, 500);

  const { data: sameDayAppointments, error: conflictError } = await supabase
    .from("appointments")
    .select("id,business_id,appointment_date,start_time,end_time,service_id,services(buffer_before_minutes,buffer_after_minutes)")
    .eq("business_id", appointment.business_id)
    .eq("appointment_date", parsed.data.appointment_date)
    .in("status", ["pending", "pending_confirmation", "confirmed"])
    .neq("id", id)
    .returns<AppointmentForConflict[]>();

  if (conflictError) return fail(conflictError.message, 500);

  const defaultBufferAfter = business.default_buffer_after_minutes ?? 0;
  const candidateStart = timeToMinutes(parsed.data.start_time) - (appointment.services?.buffer_before_minutes ?? 0);
  const candidateEnd = timeToMinutes(parsed.data.end_time) + (appointment.services?.buffer_after_minutes ?? 0) + defaultBufferAfter;
  const conflict = (sameDayAppointments ?? []).some((existing) => {
    const existingStart = timeToMinutes(existing.start_time) - (existing.services?.buffer_before_minutes ?? 0);
    const existingEnd = timeToMinutes(existing.end_time) + (existing.services?.buffer_after_minutes ?? 0) + defaultBufferAfter;
    return rangeConflicts(candidateStart, candidateEnd, existingStart, existingEnd);
  });

  if (conflict) return fail("The new time conflicts with another appointment or cleanup break.", 409);

  const { data, error } = await supabase
    .from("appointments")
    .update({ ...parsed.data, status: "pending_confirmation" })
    .eq("id", id)
    .eq("business_id", ownership.business.id)
    .select("*")
    .single();
  if (error) return fail(error.message, 500);
  return ok({ appointment: data });
}
