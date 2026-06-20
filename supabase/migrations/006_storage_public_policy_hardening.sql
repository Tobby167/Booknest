-- BookNest now uploads business logos and payment receipts through server
-- routes with the Supabase service role key. These broad public Storage
-- policies are no longer needed and can allow bucket listing.

drop policy if exists "public_insert_payment_receipts" on storage.objects;
drop policy if exists "public_read_payment_receipts" on storage.objects;
drop policy if exists "public_read_business_logos" on storage.objects;

revoke execute on function public.attach_public_receipt(uuid, text) from anon, authenticated;

-- Keep owner-managed logo writes for dashboards that may still upload directly
-- in older deployments. Current app code uses /api/business/logo.
drop policy if exists "owners_read_business_logos" on storage.objects;
create policy "owners_read_business_logos" on storage.objects
  for select to authenticated using (
    bucket_id = 'business-logos'
    and exists (
      select 1 from public.businesses b
      where b.owner_id = auth.uid()
        and b.id::text = (storage.foldername(name))[1]
    )
  );

drop policy if exists "owners_read_payment_receipts" on storage.objects;
create policy "owners_read_payment_receipts" on storage.objects
  for select to authenticated using (
    bucket_id = 'payment-receipts'
    and exists (
      select 1 from public.payments p
      where public.owns_business(p.business_id)
        and p.receipt_image_url like '%' || storage.objects.name
    )
  );

create or replace function public.enforce_appointment_booking_rules()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_notice_hours integer := 0;
  v_max_days integer := 90;
  v_start_at timestamp;
begin
  select
    coalesce(booking_notice_hours, 0),
    coalesce(max_advance_booking_days, 90)
  into v_notice_hours, v_max_days
  from public.businesses
  where id = new.business_id;

  v_start_at := new.appointment_date + new.start_time;

  if v_start_at <= (now() + make_interval(hours => v_notice_hours)) then
    raise exception 'This business requires at least % hours notice before booking.', v_notice_hours
      using errcode = 'P0001';
  end if;

  if v_start_at > ((current_date + v_max_days) + time '23:59:59') then
    raise exception 'This business only accepts bookings up to % days in advance.', v_max_days
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_appointment_booking_rules_trigger on public.appointments;
create trigger enforce_appointment_booking_rules_trigger
  before insert or update of business_id, appointment_date, start_time
  on public.appointments
  for each row execute function public.enforce_appointment_booking_rules();
