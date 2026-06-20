-- Client groups let business owners register people and target coupons/discounts
-- to a custom list, while keeping the existing broad audience choices.

create table if not exists public.client_groups (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, name)
);

create table if not exists public.client_group_members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  client_group_id uuid not null references public.client_groups(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (client_id, client_group_id)
);

alter table public.coupons
  add column if not exists target_client_group_id uuid references public.client_groups(id) on delete set null;

alter table public.service_discounts
  add column if not exists target_client_group_id uuid references public.client_groups(id) on delete set null;

alter table public.coupons drop constraint if exists coupons_audience_check;
alter table public.coupons
  add constraint coupons_audience_check
  check (audience in ('everyone', 'new_clients', 'models', 'special_people', 'client_group'));

alter table public.service_discounts drop constraint if exists service_discounts_audience_check;
alter table public.service_discounts
  add constraint service_discounts_audience_check
  check (audience in ('everyone', 'new_clients', 'models', 'special_people', 'client_group'));

create index if not exists client_groups_business_idx on public.client_groups(business_id, name);
create index if not exists client_group_members_business_group_idx on public.client_group_members(business_id, client_group_id);
create index if not exists client_group_members_client_idx on public.client_group_members(client_id);
create index if not exists coupons_target_client_group_idx on public.coupons(target_client_group_id);
create index if not exists service_discounts_target_client_group_idx on public.service_discounts(target_client_group_id);

alter table public.client_groups enable row level security;
alter table public.client_group_members enable row level security;

drop policy if exists "client_groups_owner_all" on public.client_groups;
create policy "client_groups_owner_all" on public.client_groups
  for all
  using (public.owns_business(business_id) or public.is_admin())
  with check (public.owns_business(business_id) or public.is_admin());

drop policy if exists "client_group_members_owner_all" on public.client_group_members;
create policy "client_group_members_owner_all" on public.client_group_members
  for all
  using (public.owns_business(business_id) or public.is_admin())
  with check (public.owns_business(business_id) or public.is_admin());
