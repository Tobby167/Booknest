import { fail, getOwnedBusiness, ok, requireUser } from "@/lib/api";

export async function GET() {
  const { supabase, response } = await requireUser();
  if (response) return response;

  const business = await getOwnedBusiness(supabase);
  if (!business) return ok({ payments: [] });

  const { data, error } = await supabase
    .from("payments")
    .select("*, appointments(client_name, client_email, client_phone, appointment_date, start_time, end_time, status, payment_status, total_price, notes, services(name), service_options(name))")
    .eq("business_id", business.id)
    .order("created_at", { ascending: false });
  if (error) return fail(error.message, 500);
  return ok({ payments: data ?? [] });
}
