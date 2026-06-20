import { fail, ok, requireUser } from "@/lib/api";
import { businessSettingsSchema } from "@/lib/validators";

export async function GET() {
  const { supabase, user, response } = await requireUser();
  if (response) return response;
  if (!user) return fail("Authentication required.", 401);

  const { data, error } = await supabase.from("businesses").select("*").eq("owner_id", user.id).maybeSingle();
  if (error) return fail(error.message, 500);
  return ok({ business: data });
}

export async function PUT(request: Request) {
  const { supabase, user, response } = await requireUser();
  if (response) return response;
  if (!user) return fail("Authentication required.", 401);

  const json = await request.json();
  const parsed = businessSettingsSchema.safeParse({
    ...json,
    slug: String(json.slug || "").toLowerCase()
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid business settings.");

  const { data: existing } = await supabase.from("businesses").select("id").eq("owner_id", user.id).maybeSingle();
  const payload = {
    ...parsed.data,
    owner_id: user.id,
    email: parsed.data.email || null,
    logo_url: parsed.data.logo_url || null
  };

  const query = existing
    ? supabase.from("businesses").update(payload).eq("id", existing.id).select("*").single()
    : supabase.from("businesses").insert(payload).select("*").single();

  const { data, error } = await query;
  if (error) return fail(error.message, 500);

  if (!existing && data?.id) {
    const defaultAvailability = Array.from({ length: 7 }, (_, day) => ({
      business_id: data.id,
      day_of_week: day,
      start_time: "09:00",
      end_time: "18:00",
      is_available: true
    }));
    await supabase.from("availability").insert(defaultAvailability);
  }

  return ok({ business: data });
}
