-- 026_add_ai_payment_columns.sql
-- Add AI verification columns to payments table for automated receipt review.

ALTER TABLE public.payments 
  ADD COLUMN IF NOT EXISTS ai_status text NOT NULL DEFAULT 'unchecked' 
  CONSTRAINT payments_ai_status_check CHECK (ai_status IN ('unchecked', 'checking', 'verified', 'flagged', 'failed'));

ALTER TABLE public.payments 
  ADD COLUMN IF NOT EXISTS ai_report jsonb;
