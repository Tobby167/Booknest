import { fail, ok, requireOwnedBusiness, requireUser } from "@/lib/api";
import { availabilitySchema } from "@/lib/validators";

export async function POST(request: Request) {
  const { supabase, response } = await requireUser();
  if (response) return response;

  const parsed = availabilitySchema.safeParse(await request.json());
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid availability.");

  const ownership = await requireOwnedBusiness(supabase, parsed.data.business_id);
  if (ownership.response) return ownership.response;

  const { data, error } = await supabase.from("availability").insert(parsed.data).select("*").single();
  if (error) return fail(error.message, 500);
  return ok({ availability: data }, { status: 201 });
}
