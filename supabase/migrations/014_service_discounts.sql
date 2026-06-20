-- Service discounts are automatic price rules tied to a service/option.
-- Coupons remain public/fastest-finger codes.

create table if not exists public.service_discounts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  service_option_id uuid references public.service_options(id) on delete cascade,
  name text not null,
  description text,
  discount_type text not null check (discount_type in ('percent', 'fixed', 'special_price')),
  discount_value numeric not null check (discount_value >= 0),
  audience text not null default 'everyone' check (audience in ('everyone', 'new_clients', 'models', 'special_people')),
  starts_at timestamptz,
  ends_at timestamptz,
  max_redemptions integer,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_discounts_date_order check (starts_at is null or ends_at is null or starts_at < ends_at)
);

create table if not exists public.service_discount_redemptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  service_discount_id uuid not null references public.service_discounts(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete cascade,
  client_auth_user_id uuid references auth.users(id) on delete set null,
  client_name text,
  client_email text,
  client_phone text,
  original_total numeric,
  discount_amount numeric not null default 0,
  final_total numeric,
  created_at timestamptz not null default now()
);

alter table public.appointments
  add column if not exists original_total_price numeric,
  add column if not exists service_discount_id uuid references public.service_discounts(id) on delete set null,
  add column if not exists service_discount_name text,
  add column if not exists service_discount_amount numeric default 0;

create index if not exists service_discounts_business_service_idx
  on public.service_discounts(business_id, service_id, service_option_id, is_active);

create index if not exists service_discounts_active_window_idx
  on public.service_discounts(business_id, is_active, starts_at, ends_at);

create index if not exists service_discount_redemptions_discount_idx
  on public.service_discount_redemptions(service_discount_id, created_at);

alter table public.service_discounts enable row level security;
alter table public.service_discount_redemptions enable row level security;

drop policy if exists "service_discounts_owner_all" on public.service_discounts;
create policy "service_discounts_owner_all" on public.service_discounts
  for all
  using (public.owns_business(business_id) or public.is_admin())
  with check (public.owns_business(business_id) or public.is_admin());

drop policy if exists "service_discount_redemptions_owner_read" on public.service_discount_redemptions;
create policy "service_discount_redemptions_owner_read" on public.service_discount_redemptions
  for select
  using (public.owns_business(business_id) or public.is_admin() or client_auth_user_id = auth.uid());

drop policy if exists "service_discount_redemptions_owner_update" on public.service_discount_redemptions;
create policy "service_discount_redemptions_owner_update" on public.service_discount_redemptions
  for update
  using (public.owns_business(business_id) or public.is_admin())
  with check (public.owns_business(business_id) or public.is_admin());
