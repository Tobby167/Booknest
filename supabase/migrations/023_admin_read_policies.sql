-- 023_admin_read_policies.sql
-- Grant admin-role users read access to chat_conversations and chat_messages
-- so the Admin AI Logs page can query without needing the service-role key.

-- chat_conversations: admins can read all rows
create policy "chat_conversations_admin_select" on public.chat_conversations
  for select using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- chat_messages: admins can read all rows
create policy "chat_messages_admin_select" on public.chat_messages
  for select using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );
