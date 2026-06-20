import { fail, ok, requireOwnedBusiness, requireUser } from "@/lib/api";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string }> };

const statusSchema = z.object({
  status: z.enum(["pending", "pending_confirmation", "confirmed", "cancelled", "rescheduled", "completed", "no_show"])
});

export async function PUT(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const { supabase, user, response } = await requireUser();
  if (response) return response;
  if (!user) return fail("Authentication required.", 401);

  const parsed = statusSchema.safeParse(await request.json());
  if (!parsed.success) return fail("Invalid appointment status.");

  const ownership = await requireOwnedBusiness(supabase);
  if (ownership.response) return ownership.response;

  const { data: appointment, error } = await supabase
    .from("appointments")
    .update({ status: parsed.data.status })
    .eq("id", id)
    .eq("business_id", ownership.business.id)
    .select("*")
    .single();
  if (error) return fail(error.message, 500);

  await supabase.from("audit_logs").insert({
    business_id: appointment.business_id,
    user_id: user.id,
    action: "appointment_status_updated",
    details: { appointment_id: id, status: parsed.data.status }
  });

  return ok({ appointment });
}
