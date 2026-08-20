import { fail, ok, safeError } from "@/lib/api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Public read-only endpoint used exclusively by BookingFlow after a successful
 * Stripe redirect (/book/[slug]?payment=success&appointment=[id]).
 *
 * Secure check paths implemented:
 * A. Logged-in client: owns appointment.client_auth_user_id
 * B. Business owner: owns business_id of the appointment
 * C. Guest Stripe customer: passes session_id query param matching payment's provider_checkout_session_id
 */
export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!id) return fail("Appointment ID is required.", 400);

  const { searchParams } = new URL(request.url);
  const stripeSessionId = searchParams.get("session_id");

  // Get current user session if any
  const clientSupabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await clientSupabase.auth.getUser();

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return fail("Server is not configured.", 500);
  }

  // Fetch full record from admin client (to bypass RLS for auth validation checks)
  const { data: appointment, error } = await admin
    .from("appointments")
    .select("*, services(name), service_options(name)")
    .eq("id", id)
    .maybeSingle();

  if (error) return safeError();
  if (!appointment) return fail("Appointment not found.", 404);

  // Authorization flags
  let authorized = false;

  // A. Logged-in client check
  if (user && appointment.client_auth_user_id === user.id) {
    authorized = true;
  }

  // B. Business owner check
  if (!authorized && user) {
    const { data: business } = await admin
      .from("businesses")
      .select("owner_id")
      .eq("id", appointment.business_id)
      .maybeSingle();
    if (business && business.owner_id === user.id) {
      authorized = true;
    }
  }

  // C. Stripe guest verification using token
  if (!authorized && stripeSessionId) {
    const { data: payment } = await admin
      .from("payments")
      .select("id")
      .eq("appointment_id", id)
      .eq("provider_checkout_session_id", stripeSessionId)
      .maybeSingle();
    if (payment) {
      authorized = true;
    }
  }

  if (!authorized) {
    return fail("Access denied.", 403);
  }

  // Only return confirmation safe fields
  return ok({
    appointment: {
      id: appointment.id,
      appointment_date: appointment.appointment_date,
      start_time: appointment.start_time,
      end_time: appointment.end_time,
      total_price: appointment.total_price,
      status: appointment.status,
      payment_status: appointment.payment_status,
      client_name: appointment.client_name,
      client_email: appointment.client_email,
      services: appointment.services,
      service_options: appointment.service_options
    }
  });
}
