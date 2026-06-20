-- Tighten public read access for private scheduling and storage internals.
-- Public booking pages still work through BookNest API routes, but direct
-- Supabase table access no longer reveals blocked-date/time reasons.

drop policy if exists "blocked_dates_public_read" on public.blocked_dates;
drop policy if exists "blocked_times_public_read" on public.blocked_times;

drop policy if exists "public_insert_payment_receipts" on storage.objects;
drop policy if exists "public_read_payment_receipts" on storage.objects;
drop policy if exists "public_read_business_logos" on storage.objects;

revoke execute on function public.attach_public_receipt(uuid, text) from anon, authenticated;

