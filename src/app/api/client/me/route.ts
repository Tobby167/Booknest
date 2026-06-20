import { fail, ok, requireUser } from "@/lib/api";

export async function GET() {
  const { supabase, user, response } = await requireUser();
  if (response) return response;
  if (!user) return fail("Authentication required.", 401);

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id,full_name,email,role")
    .eq("id", user.id)
    .maybeSingle();
  if (error || !profile) return fail("Client profile could not be loaded.", 500);

  return ok({
    client: {
      id: user.id,
      full_name: profile.full_name,
      email: profile.email || user.email,
      role: profile.role
    }
  });
}
