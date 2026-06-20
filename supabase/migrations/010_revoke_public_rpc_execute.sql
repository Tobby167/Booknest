-- Reduce direct REST access to SECURITY DEFINER functions.
-- BookNest calls these through server-side API routes with the service role.

revoke execute on function public.attach_public_receipt(uuid, text) from anon, authenticated;
revoke execute on function public.create_public_booking(text, uuid, uuid, uuid[], date, time, text, text, text, text, text, jsonb) from anon, authenticated;
revoke execute on function public.get_booked_appointment_ranges(text, date) from anon, authenticated;

-- These helpers are used by RLS policies. Revoke anonymous direct execution,
-- but keep authenticated execution so owner/admin policies continue working.
revoke execute on function public.current_user_role() from anon;
revoke execute on function public.is_admin() from anon;
revoke execute on function public.owns_business(uuid) from anon;

-- Auth trigger function should never be called directly from REST.
revoke execute on function public.handle_new_user() from anon, authenticated;

