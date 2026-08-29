-- 025_chat_conversations_platform_constraint.sql
-- Modify platform check constraint to allow 'copilot' as a valid platform.

ALTER TABLE public.chat_conversations DROP CONSTRAINT IF EXISTS chat_conversations_platform_check;
ALTER TABLE public.chat_conversations ADD CONSTRAINT chat_conversations_platform_check CHECK (platform IN ('whatsapp', 'telegram', 'copilot'));
