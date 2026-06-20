import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fail, ok, safeError } from "@/lib/api";

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { slug } = await context.params;
  let supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;

  try {
    supabase = await createSupabaseServerClient();
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Supabase is not configured.", 503);
  }

  const { data: business, error } = await supabase
    .from("businesses")
    .select(
      "id,name,slug,description,phone,email,address,logo_url,bank_name,bank_account_name,bank_account_number,booking_requires_owner_confirmation,currency,timezone,cancellation_policy,default_deposit_required,default_deposit_amount,booking_notice_hours,max_advance_booking_days,default_buffer_after_minutes"
    )
    .eq("slug", slug)
    .maybeSingle();

  if (error) return safeError();
  if (!business) return fail("Business not found.", 404);

  const [categories, services, options, addons, availability, formQuestions] = await Promise.all([
    supabase
      .from("service_categories")
      .select("*")
      .eq("business_id", business.id)
      .eq("is_active", true)
      .order("display_order", { ascending: true }),
    supabase
      .from("services")
      .select("*")
      .eq("business_id", business.id)
      .eq("is_active", true)
      .order("display_order", { ascending: true }),
    supabase
      .from("service_options")
      .select("*")
      .eq("business_id", business.id)
      .eq("is_active", true)
      .order("display_order", { ascending: true }),
    supabase.from("service_addons").select("*").eq("business_id", business.id).eq("is_active", true).order("name"),
    supabase.from("availability").select("id,business_id,day_of_week,start_time,end_time,is_available").eq("business_id", business.id).order("day_of_week"),
    supabase.from("form_questions").select("*").eq("business_id", business.id)
  ]);

  const firstError = [categories, services, options, addons, availability, formQuestions].find((result) => result.error);
  if (firstError?.error) return safeError();

  return ok({
    business,
    categories: categories.data ?? [],
    services: services.data ?? [],
    options: options.data ?? [],
    addons: addons.data ?? [],
    availability: availability.data ?? [],
    blockedDates: [],
    formQuestions: formQuestions.data ?? []
  });
}
