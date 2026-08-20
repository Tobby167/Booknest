-- Migration: 019_subscriptions
-- Description: Adds subscription tracking columns to businesses and sets up a 7-day free trial trigger

-- Add columns to businesses table
ALTER TABLE public.businesses 
  ADD COLUMN plan text NOT NULL DEFAULT 'starter',
  ADD COLUMN trial_ends_at timestamptz NULL,
  ADD COLUMN subscription_status text NULL,
  ADD COLUMN is_lifetime boolean NOT NULL DEFAULT false,
  ADD COLUMN subscription_id text NULL,
  ADD COLUMN stripe_customer_id text NULL,
  ADD COLUMN paystack_customer_code text NULL;

-- Create function to automatically start a 7-day trial on the Business plan
CREATE OR REPLACE FUNCTION public.handle_new_business_trial()
RETURNS TRIGGER AS $$
BEGIN
  -- Give new businesses a 7-day free trial on the Business plan
  NEW.plan := 'business';
  NEW.trial_ends_at := NOW() + INTERVAL '7 days';
  NEW.subscription_status := 'trialing';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to run before insert
CREATE TRIGGER on_business_created_trial
  BEFORE INSERT ON public.businesses
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_business_trial();
