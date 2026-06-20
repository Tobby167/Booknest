-- Adds date-specific time blocking.
-- Owners can block a full day with blocked_dates or only a time range with
-- blocked_times. Booking slots and final booking validation both respect this.

create table if not exists public.blocked_times (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  date date not null,
  start_time time not null,
  end_time time not null,
  reason text,
  created_at timestamptz default now(),
  constraint blocked_times_end_after_start check (end_time > start_time)
);

create index if not exists blocked_times_business_date_idx
  on public.blocked_times (business_id, date, start_time);

alter table public.blocked_times enable row level security;

drop policy if exists "blocked_times_public_read" on public.blocked_times;
drop policy if exists "blocked_times_owner_all" on public.blocked_times;

create policy "blocked_times_public_read" on public.blocked_times
  for select using (
    exists (
      select 1
      from public.businesses business
      where business.id = blocked_times.business_id
    )
  );

create policy "blocked_times_owner_all" on public.blocked_times
  for all using (public.owns_business(business_id) or public.is_admin())
  with check (public.owns_business(business_id) or public.is_admin());

create or replace function public.create_public_booking(
  p_business_slug text,
  p_service_id uuid,
  p_service_option_id uuid,
  p_addon_ids uuid[],
  p_appointment_date date,
  p_start_time time,
  p_client_name text,
  p_client_email text,
  p_client_phone text,
  p_notes text,
  p_receipt_image_url text default null,
  p_form_answers jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business public.businesses%rowtype;
  v_service public.services%rowtype;
  v_option public.service_options%rowtype;
  v_client_id uuid;
  v_appointment_id uuid;
  v_payment_id uuid;
  v_base_price numeric := 0;
  v_addon_price numeric := 0;
  v_total_price numeric := 0;
  v_duration integer := 60;
  v_addon_duration integer := 0;
  v_cleanup_buffer integer := 0;
  v_start_ts timestamp;
  v_end_ts timestamp;
  v_block_start timestamp;
  v_block_end timestamp;
  v_status text;
  v_payment_status text;
  v_day integer;
  v_answer jsonb;
begin
  select * into v_business
  from public.businesses
  where slug = lower(trim(p_business_slug));

  if v_business.id is null then
    raise exception 'Business not found' using errcode = 'P0001';
  end if;

  v_cleanup_buffer := coalesce(v_business.default_buffer_after_minutes, 0);

  perform pg_advisory_xact_lock(hashtext(v_business.id::text || ':' || p_appointment_date::text));

  select * into v_service
  from public.services
  where id = p_service_id
    and business_id = v_business.id
    and is_active = true;

  if v_service.id is null then
    raise exception 'Service is not available' using errcode = 'P0001';
  end if;

  if p_service_option_id is not null then
    select * into v_option
    from public.service_options
    where id = p_service_option_id
      and service_id = p_service_id
      and business_id = v_business.id
      and is_active = true;

    if v_option.id is null then
      raise exception 'Service option is not available' using errcode = 'P0001';
    end if;
  end if;

  if coalesce(array_length(p_addon_ids, 1), 0) > 0 then
    if exists (
      select 1
      from unnest(p_addon_ids) selected_addon(id)
      left join public.service_addons addon
        on addon.id = selected_addon.id
       and addon.business_id = v_business.id
       and addon.service_id = p_service_id
       and addon.is_active = true
      where addon.id is null
    ) then
      raise exception 'One or more add-ons are not available' using errcode = 'P0001';
    end if;

    select
      coalesce(sum(case when price_type = 'fixed' then price else 0 end), 0),
      coalesce(sum(duration_minutes), 0)
    into v_addon_price, v_addon_duration
    from public.service_addons
    where id = any(p_addon_ids);
  end if;

  v_base_price := case
    when p_service_option_id is not null and v_option.price_type = 'fixed' then coalesce(v_option.price, 0)
    when v_service.price_type = 'fixed' then coalesce(v_service.base_price, 0)
    else 0
  end;
  v_total_price := v_base_price + v_addon_price;
  v_duration := coalesce(v_option.duration_minutes, v_service.duration_minutes, 60) + coalesce(v_addon_duration, 0);

  if v_duration <= 0 then
    raise exception 'Service duration must be greater than zero' using errcode = 'P0001';
  end if;

  if p_appointment_date < current_date or (p_appointment_date = current_date and p_start_time <= current_time) then
    raise exception 'Appointments cannot be booked in the past' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.blocked_dates
    where business_id = v_business.id and date = p_appointment_date
  ) then
    raise exception 'Selected date is blocked' using errcode = 'P0001';
  end if;

  v_start_ts := p_appointment_date + p_start_time;
  v_end_ts := v_start_ts + make_interval(mins => v_duration);
  v_block_start := v_start_ts - make_interval(mins => coalesce(v_service.buffer_before_minutes, 0));
  v_block_end := v_end_ts + make_interval(mins => coalesce(v_service.buffer_after_minutes, 0) + v_cleanup_buffer);
  v_day := extract(dow from p_appointment_date)::integer;

  if exists (
    select 1
    from public.availability av
    where av.business_id = v_business.id
      and av.day_of_week = v_day
  ) then
    if not exists (
      select 1
      from public.availability av
      where av.business_id = v_business.id
        and av.day_of_week = v_day
        and av.is_available = true
        and p_start_time >= av.start_time
        and v_end_ts::time <= av.end_time
    ) then
      raise exception 'Selected time is outside available hours' using errcode = 'P0001';
    end if;
  elsif not (p_start_time >= time '09:00' and v_end_ts::time <= time '18:00') then
    raise exception 'Selected time is outside available hours' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.blocked_times blocked_time
    where blocked_time.business_id = v_business.id
      and blocked_time.date = p_appointment_date
      and v_block_start < (blocked_time.date + blocked_time.end_time)
      and v_block_end > (blocked_time.date + blocked_time.start_time)
  ) then
    raise exception 'Selected time is blocked by the business' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.appointments existing
    join public.businesses existing_business on existing_business.id = existing.business_id
    left join public.services existing_service on existing_service.id = existing.service_id
    where existing.business_id = v_business.id
      and existing.appointment_date = p_appointment_date
      and existing.status in ('pending', 'pending_confirmation', 'confirmed')
      and v_block_start < ((existing.appointment_date + existing.end_time)
        + make_interval(mins => coalesce(existing_service.buffer_after_minutes, 0) + coalesce(existing_business.default_buffer_after_minutes, 0)))
      and v_block_end > ((existing.appointment_date + existing.start_time)
        - make_interval(mins => coalesce(existing_service.buffer_before_minutes, 0)))
  ) then
    raise exception 'Selected time is no longer available' using errcode = 'P0001';
  end if;

  select id into v_client_id
  from public.clients
  where business_id = v_business.id
    and (
      (p_client_email is not null and email = p_client_email)
      or (p_client_phone is not null and phone = p_client_phone)
    )
  order by created_at desc
  limit 1;

  if v_client_id is null then
    insert into public.clients (business_id, name, email, phone)
    values (v_business.id, trim(p_client_name), nullif(trim(p_client_email), ''), nullif(trim(p_client_phone), ''))
    returning id into v_client_id;
  else
    update public.clients
    set name = trim(p_client_name),
        email = coalesce(nullif(trim(p_client_email), ''), email),
        phone = coalesce(nullif(trim(p_client_phone), ''), phone)
    where id = v_client_id;
  end if;

  v_status := case
    when v_service.deposit_required then 'pending_confirmation'
    when v_business.booking_requires_owner_confirmation then 'pending'
    else 'confirmed'
  end;

  v_payment_status := case
    when v_service.deposit_required and nullif(p_receipt_image_url, '') is not null then 'receipt_uploaded'
    when v_service.deposit_required then 'pending'
    else 'not_required'
  end;

  insert into public.appointments (
    business_id,
    service_id,
    service_option_id,
    client_id,
    client_name,
    client_email,
    client_phone,
    appointment_date,
    start_time,
    end_time,
    status,
    payment_status,
    total_price,
    notes
  )
  values (
    v_business.id,
    p_service_id,
    p_service_option_id,
    v_client_id,
    trim(p_client_name),
    nullif(trim(p_client_email), ''),
    nullif(trim(p_client_phone), ''),
    p_appointment_date,
    p_start_time,
    v_end_ts::time,
    v_status,
    v_payment_status,
    nullif(v_total_price, 0),
    p_notes
  )
  returning id into v_appointment_id;

  if coalesce(array_length(p_addon_ids, 1), 0) > 0 then
    insert into public.appointment_addons (appointment_id, addon_id, addon_name, addon_price)
    select v_appointment_id, addon.id, addon.name, addon.price
    from public.service_addons addon
    where addon.id = any(p_addon_ids);
  end if;

  if v_service.deposit_required then
    insert into public.payments (
      appointment_id,
      business_id,
      amount,
      receipt_image_url,
      status
    )
    values (
      v_appointment_id,
      v_business.id,
      v_service.deposit_amount,
      nullif(p_receipt_image_url, ''),
      v_payment_status
    )
    returning id into v_payment_id;
  end if;

  if jsonb_typeof(p_form_answers) = 'array' then
    for v_answer in select * from jsonb_array_elements(p_form_answers)
    loop
      if nullif(v_answer ->> 'question_id', '') is not null then
        insert into public.form_answers (appointment_id, question_id, answer)
        values (
          v_appointment_id,
          (v_answer ->> 'question_id')::uuid,
          coalesce(v_answer ->> 'answer', '')
        );
      end if;
    end loop;
  end if;

  insert into public.notifications (business_id, user_id, appointment_id, type, title, message)
  values (
    v_business.id,
    v_business.owner_id,
    v_appointment_id,
    'appointment_created',
    'New appointment booked',
    trim(p_client_name) || ' booked ' || v_service.name || ' for ' || p_appointment_date::text || ' at ' || p_start_time::text
  );

  if v_payment_status = 'receipt_uploaded' then
    insert into public.notifications (business_id, user_id, appointment_id, type, title, message)
    values (
      v_business.id,
      v_business.owner_id,
      v_appointment_id,
      'receipt_uploaded',
      'Payment receipt uploaded',
      trim(p_client_name) || ' uploaded a payment receipt for review.'
    );
  end if;

  return jsonb_build_object(
    'appointment_id', v_appointment_id,
    'payment_id', v_payment_id,
    'status', v_status,
    'payment_status', v_payment_status,
    'total_price', nullif(v_total_price, 0),
    'end_time', v_end_ts::time
  );
end;
$$;

grant execute on function public.create_public_booking(text, uuid, uuid, uuid[], date, time, text, text, text, text, text, jsonb) to anon, authenticated;
