-- Add a true no-charge price state.
-- fixed = has a known price
-- varies = owner decides price manually
-- free = no extra charge / included

alter table public.services
  drop constraint if exists services_price_type_check;

alter table public.services
  add constraint services_price_type_check
  check (price_type in ('fixed', 'varies', 'free'));

alter table public.service_options
  drop constraint if exists service_options_price_type_check;

alter table public.service_options
  add constraint service_options_price_type_check
  check (price_type in ('fixed', 'varies', 'free'));

alter table public.service_addons
  drop constraint if exists service_addons_price_type_check;

alter table public.service_addons
  add constraint service_addons_price_type_check
  check (price_type in ('fixed', 'varies', 'free'));

