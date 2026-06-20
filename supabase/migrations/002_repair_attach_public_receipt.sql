-- Repair migration for hosted projects that were migrated before the receipt
-- attachment RPC existed or where PostgREST needs the function recreated.

create or replace function public.attach_public_receipt(
  p_appointment_id uuid,
  p_receipt_image_url text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appointment public.appointments%rowtype;
  v_payment_id uuid;
  v_owner_id uuid;
begin
  if nullif(p_receipt_image_url, '') is null then
    raise exception 'Receipt URL is required' using errcode = 'P0001';
  end if;

  select * into v_appointment
  from public.appointments
  where id = p_appointment_id;

  if v_appointment.id is null then
    raise exception 'Appointment not found' using errcode = 'P0001';
  end if;

  select owner_id into v_owner_id
  from public.businesses
  where id = v_appointment.business_id;

  update public.payments
  set receipt_image_url = p_receipt_image_url,
      status = 'receipt_uploaded'
  where appointment_id = p_appointment_id
  returning id into v_payment_id;

  if v_payment_id is null then
    insert into public.payments (appointment_id, business_id, amount, receipt_image_url, status)
    values (p_appointment_id, v_appointment.business_id, v_appointment.total_price, p_receipt_image_url, 'receipt_uploaded')
    returning id into v_payment_id;
  end if;

  update public.appointments
  set payment_status = 'receipt_uploaded',
      status = case when status = 'pending' then 'pending_confirmation' else status end
  where id = p_appointment_id;

  insert into public.notifications (business_id, user_id, appointment_id, type, title, message)
  values (
    v_appointment.business_id,
    v_owner_id,
    p_appointment_id,
    'receipt_uploaded',
    'Receipt uploaded',
    v_appointment.client_name || ' uploaded a payment receipt for review.'
  );

  return jsonb_build_object('payment_id', v_payment_id, 'receipt_image_url', p_receipt_image_url);
end;
$$;

grant execute on function public.attach_public_receipt(uuid, text) to anon, authenticated;
