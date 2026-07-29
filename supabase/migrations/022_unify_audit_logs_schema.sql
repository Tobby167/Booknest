-- Migration: 022_unify_audit_logs_schema.sql
-- Description: Standardizes audit_logs schema across the entire application.
-- Single source of truth: (id, business_id, user_id, event_type, message, created_at)

-- 1. Add missing columns to audit_logs
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS event_type text,
  ADD COLUMN IF NOT EXISTS message text;

-- 2. Backfill legacy rows if any exist
UPDATE public.audit_logs
  SET event_type = COALESCE(event_type, action, 'system_event'),
      message = COALESCE(message, action, 'System event logged')
  WHERE event_type IS NULL OR message IS NULL;

-- 3. Set NOT NULL constraint on standardized columns
ALTER TABLE public.audit_logs
  ALTER COLUMN event_type SET NOT NULL,
  ALTER COLUMN message SET NOT NULL;

-- 4. Drop obsolete legacy columns
ALTER TABLE public.audit_logs
  DROP COLUMN IF EXISTS action,
  DROP COLUMN IF EXISTS details;

-- 5. Re-assert RLS policies
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_logs_owner_read" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_owner_insert" ON public.audit_logs;
DROP POLICY IF EXISTS "Admins view audit logs" ON public.audit_logs;

CREATE POLICY "Admins view audit logs" ON public.audit_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Businesses view own audit logs" ON public.audit_logs
  FOR SELECT USING (
    public.owns_business(business_id)
  );

CREATE POLICY "Businesses insert own audit logs" ON public.audit_logs
  FOR INSERT WITH CHECK (
    public.owns_business(business_id)
  );

-- 6. Ensure Triggers for Automatic Audit Logging
CREATE OR REPLACE FUNCTION public.log_new_business() RETURNS trigger AS $$
BEGIN
  INSERT INTO public.audit_logs (business_id, event_type, message)
  VALUES (NEW.id, 'business_created', 'New business signed up: ' || NEW.name);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_log_new_business ON public.businesses;
CREATE TRIGGER trigger_log_new_business
AFTER INSERT ON public.businesses
FOR EACH ROW EXECUTE FUNCTION public.log_new_business();

CREATE OR REPLACE FUNCTION public.log_new_appointment() RETURNS trigger AS $$
BEGIN
  INSERT INTO public.audit_logs (business_id, event_type, message)
  VALUES (NEW.business_id, 'appointment_booked', 'Received a new appointment for ' || NEW.client_name);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_log_new_appointment ON public.appointments;
CREATE TRIGGER trigger_log_new_appointment
AFTER INSERT ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.log_new_appointment();

CREATE OR REPLACE FUNCTION public.log_payment_update() RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed') THEN
    INSERT INTO public.audit_logs (business_id, event_type, message)
    VALUES (NEW.business_id, 'payment_confirmed', 'Received a payment of ' || NEW.amount);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_log_payment_update ON public.payments;
CREATE TRIGGER trigger_log_payment_update
AFTER UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.log_payment_update();
