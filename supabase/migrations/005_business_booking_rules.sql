alter table public.businesses
  add column if not exists currency text not null default 'USD',
  add column if not exists timezone text not null default 'America/Chicago',
  add column if not exists cancellation_policy text,
  add column if not exists default_deposit_required boolean not null default false,
  add column if not exists default_deposit_amount numeric,
  add column if not exists booking_notice_hours integer not null default 0,
  add column if not exists max_advance_booking_days integer not null default 90;

alter table public.businesses
  drop constraint if exists businesses_currency_format,
  add constraint businesses_currency_format check (currency ~ '^[A-Z]{3}$');

alter table public.businesses
  drop constraint if exists businesses_booking_notice_hours_nonnegative,
  add constraint businesses_booking_notice_hours_nonnegative check (booking_notice_hours >= 0);

alter table public.businesses
  drop constraint if exists businesses_max_advance_booking_days_positive,
  add constraint businesses_max_advance_booking_days_positive check (max_advance_booking_days between 1 and 730);
