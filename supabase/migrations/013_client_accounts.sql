-- Client account support.
-- Clients can log in separately from business owners, view their bookings,
-- and later use login-protected coupons/model pricing.

alter table public.clients
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null,
  add column if not exists client_type text not null default 'regular'
    check (client_type in ('regular', 'new_client', 'model', 'special_person', 'vip')),
  add column if not exists is_approved boolean not null default false;

alter table public.appointments
  add column if not exists client_auth_user_id uuid references auth.users(id) on delete set null;

alter table public.coupon_redemptions
  add column if not exists client_auth_user_id uuid references auth.users(id) on delete set null;

create index if not exists clients_auth_user_idx on public.clients(auth_user_id);
create index if not exists clients_business_auth_user_idx on public.clients(business_id, auth_user_id);
create index if not exists appointments_client_auth_user_idx on public.appointments(client_auth_user_id, appointment_date, start_time);
create index if not exists coupon_redemptions_auth_user_idx on public.coupon_redemptions(coupon_id, client_auth_user_id);

drop policy if exists "clients_client_read_own" on public.clients;
create policy "clients_client_read_own" on public.clients
  for select
  using (auth_user_id = auth.uid());

drop policy if exists "appointments_client_read_own" on public.appointments;
create policy "appointments_client_read_own" on public.appointments
  for select
  using (client_auth_user_id = auth.uid());

drop policy if exists "coupon_redemptions_client_read_own" on public.coupon_redemptions;
create policy "coupon_redemptions_client_read_own" on public.coupon_redemptions
  for select
  using (client_auth_user_id = auth.uid());
