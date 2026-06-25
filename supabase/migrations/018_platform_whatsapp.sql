-- ============================================================
-- 018_platform_whatsapp.sql
-- Adds whatsapp_enabled flag to businesses table.
-- BookNest operates a single shared WhatsApp Cloud API number
-- (configured via PLATFORM_WA_* env vars). Business owners
-- simply toggle this flag ON to receive a unique booking link.
-- No per-business API credentials are required or stored.
-- ============================================================

alter table public.businesses
  add column if not exists whatsapp_enabled boolean not null default false;

comment on column public.businesses.whatsapp_enabled is
  'When true, the business is reachable via the BookNest shared WhatsApp number. '
  'Customers use a slug-based link (wa.me/...?text=START+{slug}) to initiate booking.';
