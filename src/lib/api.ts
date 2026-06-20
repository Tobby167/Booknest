import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function fail(message: string, status = 400) {
  const publicMessage = status >= 500 ? "Something went wrong. Please try again." : message;
  return NextResponse.json({ error: publicMessage }, { status });
}

export function safeError(status = 500) {
  return fail("Something went wrong. Please try again.", status);
}

export async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { supabase, user: null, response: fail("Authentication required.", 401) };
  }

  return { supabase, user, response: null };
}

export async function getOwnedBusiness(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>) {
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase.from("businesses").select("*").eq("owner_id", user.id).maybeSingle();
  return data;
}

export async function requireOwnedBusiness(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, businessId?: string | null) {
  const business = await getOwnedBusiness(supabase);
  if (!business) return { business: null, response: fail("Create your business profile first.", 400) };
  if (businessId && business.id !== businessId) return { business: null, response: fail("You can only manage your own business data.", 403) };
  return { business, response: null };
}
