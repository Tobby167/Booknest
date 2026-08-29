-- 024_chat_conversations_owner_insert.sql
-- Allow business owners to insert/create chat conversations they own.
-- This enables dashboard copilot conversations to be saved to the database.

create policy "chat_conversations_owner_insert" on public.chat_conversations
  for insert with check (public.owns_business(business_id));
