alter table public.payments
  add column if not exists provider text,
  add column if not exists provider_payment_id text,
  add column if not exists provider_checkout_session_id text,
  add column if not exists provider_checkout_url text,
  add column if not exists provider_currency text default 'usd',
  add column if not exists provider_metadata jsonb default '{}'::jsonb;

create index if not exists payments_provider_checkout_session_id_idx
  on public.payments(provider_checkout_session_id);
