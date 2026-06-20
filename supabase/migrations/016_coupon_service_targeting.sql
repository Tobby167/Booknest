-- Coupon service targeting.
-- Coupons stay code-based/fastest-finger, but can now be limited to all services,
-- one service, or one specific service option.

alter table public.coupons
  add column if not exists service_id uuid references public.services(id) on delete set null,
  add column if not exists service_option_id uuid references public.service_options(id) on delete set null;

create index if not exists coupons_service_target_idx on public.coupons(business_id, service_id);
create index if not exists coupons_option_target_idx on public.coupons(business_id, service_option_id);
