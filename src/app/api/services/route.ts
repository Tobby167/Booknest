import { fail, ok, requireOwnedBusiness, requireUser } from "@/lib/api";
import { serviceSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const { supabase, response } = await requireUser();
  if (response) return response;

  const parsed = serviceSchema.safeParse(await request.json());
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid service.");

  const ownership = await requireOwnedBusiness(supabase, parsed.data.business_id);
  if (ownership.response) return ownership.response;

  // Enforce Starter plan service limit (max 3)
  if (ownership.business.plan === "starter" && !ownership.business.is_lifetime) {
    const { count, error: countError } = await supabase
      .from("services")
      .select("*", { count: "exact", head: true })
      .eq("business_id", ownership.business.id);

    if (countError) return fail("Failed to verify service limits.", 500);
    if ((count || 0) >= 3) {
      return fail("Starter plan allows a maximum of 3 services. Please upgrade your plan to add more.", 403);
    }
  }

  if (parsed.data.category_id) {
    const { data: category, error: categoryError } = await supabase
      .from("service_categories")
      .select("id")
      .eq("id", parsed.data.category_id)
      .eq("business_id", ownership.business.id)
      .maybeSingle();
    if (categoryError) return fail("Category could not be verified.", 500);
    if (!category) return fail("Category does not belong to this business.", 403);
  }

  const { data, error } = await supabase.from("services").insert(parsed.data).select("*").single();
  if (error) return fail(error.message, 500);
  return ok({ service: data }, { status: 201 });
}
