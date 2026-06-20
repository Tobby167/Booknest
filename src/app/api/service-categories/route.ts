import { fail, ok, requireOwnedBusiness, requireUser } from "@/lib/api";
import { serviceCategorySchema } from "@/lib/validators";

export async function POST(request: Request) {
  const { supabase, response } = await requireUser();
  if (response) return response;

  const parsed = serviceCategorySchema.safeParse(await request.json());
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid category.");

  const ownership = await requireOwnedBusiness(supabase, parsed.data.business_id);
  if (ownership.response) return ownership.response;

  const { data, error } = await supabase.from("service_categories").insert(parsed.data).select("*").single();
  if (error) return fail(error.message, 500);
  return ok({ category: data }, { status: 201 });
}
