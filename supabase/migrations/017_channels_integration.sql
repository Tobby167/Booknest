-- ============================================================
-- 017_channels_integration.sql
-- WhatsApp + Telegram native channel integration tables
-- ============================================================

-- WhatsApp Business Cloud API credentials per business
create table if not exists public.whatsapp_integrations (
  id                  uuid primary key default gen_random_uuid(),
  business_id         uuid not null references public.businesses(id) on delete cascade,
  phone_number_id     text not null,
  waba_id             text not null,
  -- encrypted with AES-256-CBC via ENCRYPTION_KEY env var
  access_token_enc    text not null,
  -- token businesses enter in Meta App Dashboard → Webhooks → Verify Token
  verify_token        text not null,
  -- Meta App Secret for webhook signature verification (HMAC-SHA256)
  app_secret_enc      text not null,
  display_phone       text,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint whatsapp_integrations_business_unique unique (business_id)
);

-- Telegram Bot API credentials per business
create table if not exists public.telegram_integrations (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references public.businesses(id) on delete cascade,
  bot_username     text not null,
  -- encrypted with AES-256-CBC via ENCRYPTION_KEY env var
  bot_token_enc    text not null,
  -- random secret token we set on the webhook so Telegram signs requests
  webhook_secret   text not null,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint telegram_integrations_business_unique unique (business_id)
);

-- One conversation row per customer × business × platform
create table if not exists public.chat_conversations (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references public.businesses(id) on delete cascade,
  -- 'whatsapp' | 'telegram'
  platform         text not null check (platform in ('whatsapp', 'telegram')),
  -- WhatsApp: customer phone (e.g. 2348012345678)
  -- Telegram: numeric chat_id (as text)
  external_chat_id text not null,
  -- matched BookNest client record (may be null before name collected)
  client_id        uuid references public.clients(id) on delete set null,
  client_name      text,
  -- JSONB state machine payload
  -- Example: {"step":"awaiting_time","service_id":"...","date":"2026-06-24","slots":["10:00:00","13:00:00"]}
  state            jsonb not null default '{"step":"idle"}'::jsonb,
  last_message_at  timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  constraint chat_conversations_unique unique (business_id, platform, external_chat_id)
);

-- Individual messages stored for full conversation history
create table if not exists public.chat_messages (
  id                  uuid primary key default gen_random_uuid(),
  conversation_id     uuid not null references public.chat_conversations(id) on delete cascade,
  business_id         uuid not null references public.businesses(id) on delete cascade,
  -- 'customer' | 'system'
  sender              text not null check (sender in ('customer', 'system')),
  body                text not null,
  -- platform message id for idempotency / deduplication
  external_message_id text,
  created_at          timestamptz not null default now()
);

-- Indexes
create index if not exists whatsapp_integrations_business_idx
  on public.whatsapp_integrations(business_id);

create index if not exists telegram_integrations_business_idx
  on public.telegram_integrations(business_id);

create index if not exists chat_conversations_business_idx
  on public.chat_conversations(business_id, platform, last_message_at desc);

create index if not exists chat_conversations_external_idx
  on public.chat_conversations(business_id, platform, external_chat_id);

create index if not exists chat_messages_conversation_idx
  on public.chat_messages(conversation_id, created_at asc);

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.whatsapp_integrations enable row level security;
alter table public.telegram_integrations  enable row level security;
alter table public.chat_conversations     enable row level security;
alter table public.chat_messages          enable row level security;

-- whatsapp_integrations
create policy "whatsapp_integrations_owner_all" on public.whatsapp_integrations
  for all using (public.owns_business(business_id))
  with check (public.owns_business(business_id));

-- telegram_integrations
create policy "telegram_integrations_owner_all" on public.telegram_integrations
  for all using (public.owns_business(business_id))
  with check (public.owns_business(business_id));

-- chat_conversations
create policy "chat_conversations_owner_select" on public.chat_conversations
  for select using (public.owns_business(business_id));

create policy "chat_conversations_owner_update" on public.chat_conversations
  for update using (public.owns_business(business_id))
  with check (public.owns_business(business_id));

-- service-role (webhook) can insert/update conversations without auth
create policy "chat_conversations_service_role_all" on public.chat_conversations
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- chat_messages
create policy "chat_messages_owner_select" on public.chat_messages
  for select using (public.owns_business(business_id));

create policy "chat_messages_service_role_all" on public.chat_messages
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- Allow dashboard to insert manual (system) replies
create policy "chat_messages_owner_insert" on public.chat_messages
  for insert with check (public.owns_business(business_id));
