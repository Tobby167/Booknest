import { fail, getOwnedBusiness, ok, requireUser } from "@/lib/api";

export async function GET() {
  const { supabase, response } = await requireUser();
  if (response) return response;

  const business = await getOwnedBusiness(supabase);
  if (!business) return ok({ business: null, categories: [], services: [], options: [], addons: [] });

  const [categories, services, options, addons] = await Promise.all([
    supabase.from("service_categories").select("*").eq("business_id", business.id).order("display_order"),
    supabase.from("services").select("*").eq("business_id", business.id).order("display_order"),
    supabase.from("service_options").select("*").eq("business_id", business.id).order("display_order"),
    supabase.from("service_addons").select("*").eq("business_id", business.id).order("name")
  ]);

  const firstError = [categories, services, options, addons].find((result) => result.error);
  if (firstError?.error) return fail(firstError.error.message, 500);

  return ok({
    business,
    categories: categories.data ?? [],
    services: services.data ?? [],
    options: options.data ?? [],
    addons: addons.data ?? []
  });
}
