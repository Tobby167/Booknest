-- Coupon and discount support for BookNest.
-- This keeps validation server-side while preparing for client-login coupons later.

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  discount_type text not null default 'percent' check (discount_type in ('percent', 'fixed')),
  discount_value numeric not null check (discount_value >= 0),
  audience text not null default 'everyone' check (audience in ('everyone', 'new_clients', 'models', 'special_people')),
  requires_login boolean not null default false,
  requires_owner_approval boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  max_redemptions integer check (max_redemptions is null or max_redemptions > 0),
  max_redemptions_per_client integer not null default 1 check (max_redemptions_per_client > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coupons_code_format check (code = upper(code) and code ~ '^[A-Z0-9][A-Z0-9_-]{1,30}$'),
  constraint coupons_date_order check (starts_at is null or ends_at is null or starts_at < ends_at),
  unique (business_id, code)
);

create table if not exists public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  client_auth_user_id uuid references auth.users(id) on delete set null,
  client_name text,
  client_email text,
  client_phone text,
  original_total numeric,
  discount_amount numeric not null default 0,
  final_total numeric,
  status text not null default 'applied' check (status in ('applied', 'pending_owner_approval', 'rejected')),
  created_at timestamptz not null default now()
);

alter table public.appointments
  add column if not exists coupon_id uuid references public.coupons(id) on delete set null,
  add column if not exists coupon_code text,
  add column if not exists discount_amount numeric not null default 0;

create index if not exists coupons_business_code_idx on public.coupons(business_id, code);
create index if not exists coupons_business_active_idx on public.coupons(business_id, is_active);
create index if not exists coupon_redemptions_coupon_idx on public.coupon_redemptions(coupon_id, created_at);
create index if not exists coupon_redemptions_client_lookup_idx
  on public.coupon_redemptions(business_id, lower(coalesce(client_email, '')), regexp_replace(coalesce(client_phone, ''), '\D', '', 'g'));
create index if not exists appointments_coupon_idx on public.appointments(coupon_id);

alter table public.coupons enable row level security;
alter table public.coupon_redemptions enable row level security;

drop policy if exists "coupons_owner_all" on public.coupons;
create policy "coupons_owner_all" on public.coupons
  for all
  using (public.owns_business(business_id) or public.is_admin())
  with check (public.owns_business(business_id) or public.is_admin());

drop policy if exists "coupon_redemptions_owner_read" on public.coupon_redemptions;
create policy "coupon_redemptions_owner_read" on public.coupon_redemptions
  for select
  using (public.owns_business(business_id) or public.is_admin());

drop policy if exists "coupon_redemptions_owner_update" on public.coupon_redemptions;
create policy "coupon_redemptions_owner_update" on public.coupon_redemptions
  for update
  using (public.owns_business(business_id) or public.is_admin())
  with check (public.owns_business(business_id) or public.is_admin());
