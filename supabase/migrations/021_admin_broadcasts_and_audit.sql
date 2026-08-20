-- Migration: 021_admin_broadcasts_and_audit
-- Description: Adds tables and triggers for the Global Megaphone and Activity Logs

-- 1. Global Broadcasts (Megaphone)
CREATE TABLE public.admin_broadcasts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  message text NOT NULL,
  tone text NOT NULL DEFAULT 'blue', -- 'blue', 'amber', 'emerald', 'red'
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- RLS: Only admins can manage broadcasts. 
-- Wait, we can bypass RLS using Server API, so we'll just deny public access.
ALTER TABLE public.admin_broadcasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage broadcasts" ON public.admin_broadcasts USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
-- Businesses only need SELECT access to active broadcasts
CREATE POLICY "Anyone can view active broadcasts" ON public.admin_broadcasts FOR SELECT USING (is_active = true);


-- 2. Audit Logs (The Watcher)
CREATE TABLE public.audit_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE,
  event_type text NOT NULL, -- e.g., 'business_created', 'appointment_booked', 'payment_received'
  message text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view audit logs" ON public.audit_logs FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 3. Automated Postgres Triggers for Audit Logs
-- These triggers will automatically write to audit_logs without needing to change Next.js API code!

-- A. Trigger for New Businesses
CREATE OR REPLACE FUNCTION public.log_new_business() RETURNS trigger AS $$
BEGIN
  INSERT INTO public.audit_logs (business_id, event_type, message)
  VALUES (NEW.id, 'business_created', 'New business signed up: ' || NEW.name);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_log_new_business
AFTER INSERT ON public.businesses
FOR EACH ROW EXECUTE FUNCTION public.log_new_business();

-- B. Trigger for New Appointments
CREATE OR REPLACE FUNCTION public.log_new_appointment() RETURNS trigger AS $$
BEGIN
  INSERT INTO public.audit_logs (business_id, event_type, message)
  VALUES (NEW.business_id, 'appointment_booked', 'Received a new appointment for ' || NEW.client_name);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_log_new_appointment
AFTER INSERT ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.log_new_appointment();

-- C. Trigger for Confirmed Payments
CREATE OR REPLACE FUNCTION public.log_payment_update() RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed') THEN
    INSERT INTO public.audit_logs (business_id, event_type, message)
    VALUES (NEW.business_id, 'payment_confirmed', 'Received a payment of ' || NEW.amount);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_log_payment_update
AFTER UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.log_payment_update();
