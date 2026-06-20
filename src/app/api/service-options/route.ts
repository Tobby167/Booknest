import { fail, ok, requireOwnedBusiness, requireUser } from "@/lib/api";
import { serviceOptionSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const { supabase, response } = await requireUser();
  if (response) return response;

  const parsed = serviceOptionSchema.safeParse(await request.json());
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid option.");

  const ownership = await requireOwnedBusiness(supabase, parsed.data.business_id);
  if (ownership.response) return ownership.response;

  const { data: service, error: serviceError } = await supabase
    .from("services")
    .select("id")
    .eq("id", parsed.data.service_id)
    .eq("business_id", ownership.business.id)
    .maybeSingle();
  if (serviceError) return fail("Service could not be verified.", 500);
  if (!service) return fail("Service does not belong to this business.", 403);

  const { data, error } = await supabase.from("service_options").insert(parsed.data).select("*").single();
  if (error) return fail(error.message, 500);
  return ok({ option: data }, { status: 201 });
}
