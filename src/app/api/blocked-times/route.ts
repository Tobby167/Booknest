import { fail, getOwnedBusiness, ok, requireUser } from "@/lib/api";
import { z } from "zod";

const blockedTimeSchema = z.object({
  business_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_time: z.string().regex(/^\d{2}:\d{2}/),
  end_time: z.string().regex(/^\d{2}:\d{2}/),
  reason: z.string().optional().nullable()
});

export async function POST(request: Request) {
  const { supabase, response } = await requireUser();
  if (response) return response;

  const business = await getOwnedBusiness(supabase);
  if (!business) return fail("Create your business profile first.", 400);

  const parsed = blockedTimeSchema.safeParse(await request.json());
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid blocked time.");
  if (parsed.data.business_id !== business.id) return fail("You can only block time for your own business.", 403);
  if (parsed.data.end_time <= parsed.data.start_time) return fail("End time must be after start time.");

  const { data, error } = await supabase.from("blocked_times").insert(parsed.data).select("*").single();
  if (error) return fail(error.message, 500);
  return ok({ blockedTime: data }, { status: 201 });
}
