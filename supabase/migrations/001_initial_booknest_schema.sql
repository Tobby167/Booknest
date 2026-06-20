create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  role text not null default 'business_owner' check (role in ('business_owner', 'staff', 'client', 'admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  slug text unique not null,
  description text,
  phone text,
  email text,
  address text,
  logo_url text,
  bank_name text,
  bank_account_name text,
  bank_account_number text,
  booking_requires_owner_confirmation boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.service_categories (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  description text,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  category_id uuid references public.service_categories(id) on delete set null,
  name text not null,
  description text,
  base_price numeric,
  price_type text not null default 'fixed' check (price_type in ('fixed', 'varies')),
  duration_minutes integer,
  deposit_required boolean not null default false,
  deposit_amount numeric,
  buffer_before_minutes integer not null default 0,
  buffer_after_minutes integer not null default 0,
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.service_options (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  name text not null,
  description text,
  price numeric,
  price_type text not null default 'fixed' check (price_type in ('fixed', 'varies')),
  duration_minutes integer,
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.service_addons (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  name text not null,
  description text,
  price numeric,
  price_type text not null default 'fixed' check (price_type in ('fixed', 'varies')),
  duration_minutes integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.availability (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  day_of_week integer not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  is_available boolean not null default true,
  constraint availability_end_after_start check (end_time > start_time)
);

create table if not exists public.blocked_dates (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  date date not null,
  reason text
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  created_at timestamptz not null default now()
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  service_id uuid references public.services(id),
  service_option_id uuid references public.service_options(id),
  client_id uuid references public.clients(id),
  client_name text not null,
  client_email text,
  client_phone text,
  appointment_date date not null,
  start_time time not null,
  end_time time not null,
  status text not null default 'pending' check (status in ('pending', 'pending_confirmation', 'confirmed', 'cancelled', 'rescheduled', 'completed', 'no_show')),
  payment_status text not null default 'not_required' check (payment_status in ('not_required', 'pending', 'receipt_uploaded', 'confirmed', 'rejected')),
  total_price numeric,
  notes text,
  created_at timestamptz not null default now(),
  constraint appointments_end_after_start check (end_time > start_time)
);

create table if not exists public.appointment_addons (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  addon_id uuid references public.service_addons(id),
  addon_name text,
  addon_price numeric
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  amount numeric,
  method text not null default 'bank_transfer',
  receipt_image_url text,
  status text not null default 'pending' check (status in ('pending', 'receipt_uploaded', 'confirmed', 'rejected')),
  confirmed_by uuid references public.profiles(id),
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid references public.profiles(id),
  appointment_id uuid references public.appointments(id) on delete cascade,
  type text,
  title text,
  message text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.form_questions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  service_id uuid references public.services(id) on delete cascade,
  question text not null,
  field_type text,
  is_required boolean not null default false,
  options jsonb
);

create table if not exists public.form_answers (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  question_id uuid not null references public.form_questions(id) on delete cascade,
  answer text
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  user_id uuid references public.profiles(id),
  action text,
  details jsonb,
  created_at timestamptz not null default now()
);

create index if not exists businesses_owner_idx on public.businesses(owner_id);
create index if not exists businesses_slug_idx on public.businesses(slug);
create index if not exists service_categories_business_idx on public.service_categories(business_id, display_order);
create index if not exists services_business_idx on public.services(business_id, display_order);
create index if not exists service_options_service_idx on public.service_options(service_id, display_order);
create index if not exists service_addons_service_idx on public.service_addons(service_id);
create index if not exists appointments_business_date_idx on public.appointments(business_id, appointment_date, start_time);
create index if not exists payments_business_idx on public.payments(business_id, status);
create index if not exists notifications_user_idx on public.notifications(user_id, is_read, created_at desc);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    coalesce(nullif(new.raw_user_meta_data->>'role', ''), 'business_owner')
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(nullif(excluded.full_name, ''), public.profiles.full_name);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() = 'admin', false);
$$;

create or replace function public.owns_business(target_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.businesses b
    where b.id = target_business_id
      and b.owner_id = auth.uid()
  ) or public.is_admin();
$$;

create or replace function public.get_booked_appointment_ranges(p_business_slug text, p_date date)
returns table (start_time time, end_time time)
language sql
stable
security definer
set search_path = public
as $$
  select
    ((a.appointment_date + a.start_time)
      - make_interval(mins => coalesce(s.buffer_before_minutes, 0)))::time as start_time,
    ((a.appointment_date + a.end_time)
      + make_interval(mins => coalesce(s.buffer_after_minutes, 0)))::time as end_time
  from public.appointments a
  join public.businesses b on b.id = a.business_id
  left join public.services s on s.id = a.service_id
  where b.slug = p_business_slug
    and a.appointment_date = p_date
    and a.status in ('pending', 'pending_confirmation', 'confirmed');
$$;

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
  v_block_end := v_end_ts + make_interval(mins => coalesce(v_service.buffer_after_minutes, 0));
  v_day := extract(dow from p_appointment_date)::integer;

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

  if exists (
    select 1
    from public.appointments existing
    left join public.services existing_service on existing_service.id = existing.service_id
    where existing.business_id = v_business.id
      and existing.appointment_date = p_appointment_date
      and existing.status in ('pending', 'pending_confirmation', 'confirmed')
      and v_block_start < ((existing.appointment_date + existing.end_time)
        + make_interval(mins => coalesce(existing_service.buffer_after_minutes, 0)))
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
    v_service.id,
    v_option.id,
    v_client_id,
    trim(p_client_name),
    nullif(trim(p_client_email), ''),
    nullif(trim(p_client_phone), ''),
    p_appointment_date,
    p_start_time,
    v_end_ts::time,
    v_status,
    v_payment_status,
    v_total_price,
    nullif(trim(p_notes), '')
  )
  returning id into v_appointment_id;

  insert into public.appointment_addons (appointment_id, addon_id, addon_name, addon_price)
  select v_appointment_id, addon.id, addon.name, addon.price
  from public.service_addons addon
  where addon.id = any(coalesce(p_addon_ids, array[]::uuid[]));

  if v_service.deposit_required or nullif(p_receipt_image_url, '') is not null then
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
      coalesce(v_service.deposit_amount, v_total_price),
      nullif(p_receipt_image_url, ''),
      case when nullif(p_receipt_image_url, '') is not null then 'receipt_uploaded' else 'pending' end
    )
    returning id into v_payment_id;
  end if;

  if jsonb_typeof(p_form_answers) = 'array' then
    for v_answer in select * from jsonb_array_elements(p_form_answers)
    loop
      if (v_answer ? 'question_id') and (v_answer ? 'answer') then
        insert into public.form_answers (appointment_id, question_id, answer)
        select v_appointment_id, (v_answer->>'question_id')::uuid, v_answer->>'answer'
        from public.form_questions fq
        where fq.id = (v_answer->>'question_id')::uuid
          and fq.business_id = v_business.id;
      end if;
    end loop;
  end if;

  insert into public.notifications (business_id, user_id, appointment_id, type, title, message)
  values (
    v_business.id,
    v_business.owner_id,
    v_appointment_id,
    'new_booking',
    'New appointment booked',
    trim(p_client_name) || ' booked ' || v_service.name || ' for ' || p_appointment_date::text || ' at ' || p_start_time::text || '.'
  );

  if v_payment_status = 'receipt_uploaded' then
    insert into public.notifications (business_id, user_id, appointment_id, type, title, message)
    values (
      v_business.id,
      v_business.owner_id,
      v_appointment_id,
      'receipt_uploaded',
      'Receipt uploaded',
      trim(p_client_name) || ' uploaded a payment receipt for review.'
    );
  end if;

  return jsonb_build_object(
    'appointment_id', v_appointment_id,
    'client_id', v_client_id,
    'payment_id', v_payment_id,
    'status', v_status,
    'payment_status', v_payment_status,
    'total_price', v_total_price,
    'end_time', v_end_ts::time
  );
end;
$$;

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

alter table public.profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.service_categories enable row level security;
alter table public.services enable row level security;
alter table public.service_options enable row level security;
alter table public.service_addons enable row level security;
alter table public.availability enable row level security;
alter table public.blocked_dates enable row level security;
alter table public.clients enable row level security;
alter table public.appointments enable row level security;
alter table public.appointment_addons enable row level security;
alter table public.payments enable row level security;
alter table public.notifications enable row level security;
alter table public.form_questions enable row level security;
alter table public.form_answers enable row level security;
alter table public.audit_logs enable row level security;

create policy "profiles_select_self_or_admin" on public.profiles
  for select using (id = auth.uid() or public.is_admin());
create policy "profiles_update_self_or_admin" on public.profiles
  for update using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());
create policy "profiles_insert_self" on public.profiles
  for insert with check (id = auth.uid() or public.is_admin());

create policy "businesses_public_read" on public.businesses
  for select using (true);
create policy "businesses_owner_insert" on public.businesses
  for insert with check (owner_id = auth.uid() or public.is_admin());
create policy "businesses_owner_update" on public.businesses
  for update using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());
create policy "businesses_owner_delete" on public.businesses
  for delete using (owner_id = auth.uid() or public.is_admin());

create policy "categories_public_read_active" on public.service_categories
  for select using (is_active = true or public.owns_business(business_id));
create policy "categories_owner_all" on public.service_categories
  for all using (public.owns_business(business_id))
  with check (public.owns_business(business_id));

create policy "services_public_read_active" on public.services
  for select using (is_active = true or public.owns_business(business_id));
create policy "services_owner_all" on public.services
  for all using (public.owns_business(business_id))
  with check (public.owns_business(business_id));

create policy "options_public_read_active" on public.service_options
  for select using (is_active = true or public.owns_business(business_id));
create policy "options_owner_all" on public.service_options
  for all using (public.owns_business(business_id))
  with check (public.owns_business(business_id));

create policy "addons_public_read_active" on public.service_addons
  for select using (is_active = true or public.owns_business(business_id));
create policy "addons_owner_all" on public.service_addons
  for all using (public.owns_business(business_id))
  with check (public.owns_business(business_id));

create policy "availability_public_read" on public.availability
  for select using (is_available = true or public.owns_business(business_id));
create policy "availability_owner_all" on public.availability
  for all using (public.owns_business(business_id))
  with check (public.owns_business(business_id));

create policy "blocked_dates_public_read" on public.blocked_dates
  for select using (true);
create policy "blocked_dates_owner_all" on public.blocked_dates
  for all using (public.owns_business(business_id))
  with check (public.owns_business(business_id));

create policy "clients_owner_read" on public.clients
  for select using (public.owns_business(business_id));
create policy "clients_owner_all" on public.clients
  for all using (public.owns_business(business_id))
  with check (public.owns_business(business_id));

create policy "appointments_owner_read" on public.appointments
  for select using (public.owns_business(business_id));
create policy "appointments_owner_update" on public.appointments
  for update using (public.owns_business(business_id))
  with check (public.owns_business(business_id));
create policy "appointments_owner_delete" on public.appointments
  for delete using (public.owns_business(business_id));

create policy "appointment_addons_owner_read" on public.appointment_addons
  for select using (
    exists (
      select 1 from public.appointments a
      where a.id = appointment_id and public.owns_business(a.business_id)
    )
  );

create policy "payments_owner_read" on public.payments
  for select using (public.owns_business(business_id));
create policy "payments_owner_update" on public.payments
  for update using (public.owns_business(business_id))
  with check (public.owns_business(business_id));

create policy "notifications_owner_read" on public.notifications
  for select using (user_id = auth.uid() or public.owns_business(business_id));
create policy "notifications_owner_update" on public.notifications
  for update using (user_id = auth.uid() or public.owns_business(business_id))
  with check (user_id = auth.uid() or public.owns_business(business_id));
create policy "notifications_owner_insert" on public.notifications
  for insert with check (public.owns_business(business_id));

create policy "form_questions_public_read" on public.form_questions
  for select using (true);
create policy "form_questions_owner_all" on public.form_questions
  for all using (public.owns_business(business_id))
  with check (public.owns_business(business_id));

create policy "form_answers_owner_read" on public.form_answers
  for select using (
    exists (
      select 1
      from public.appointments a
      where a.id = appointment_id and public.owns_business(a.business_id)
    )
  );

create policy "audit_logs_owner_read" on public.audit_logs
  for select using (public.owns_business(business_id) or public.is_admin());
create policy "audit_logs_owner_insert" on public.audit_logs
  for insert with check (public.owns_business(business_id) or public.is_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('business-logos', 'business-logos', true, 2097152, array['image/png', 'image/jpeg', 'image/webp']),
  ('payment-receipts', 'payment-receipts', true, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "public_read_business_logos" on storage.objects
  for select using (bucket_id = 'business-logos');
create policy "owners_upload_business_logos" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'business-logos'
    and exists (
      select 1 from public.businesses b
      where b.owner_id = auth.uid()
        and b.id::text = (storage.foldername(name))[1]
    )
  );
create policy "owners_update_business_logos" on storage.objects
  for update to authenticated using (
    bucket_id = 'business-logos'
    and exists (
      select 1 from public.businesses b
      where b.owner_id = auth.uid()
        and b.id::text = (storage.foldername(name))[1]
    )
  );
create policy "public_insert_payment_receipts" on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'payment-receipts');
create policy "public_read_payment_receipts" on storage.objects
  for select using (bucket_id = 'payment-receipts');

grant execute on function public.get_booked_appointment_ranges(text, date) to anon, authenticated;
grant execute on function public.create_public_booking(text, uuid, uuid, uuid[], date, time, text, text, text, text, text, jsonb) to anon, authenticated;
grant execute on function public.attach_public_receipt(uuid, text) to anon, authenticated;
