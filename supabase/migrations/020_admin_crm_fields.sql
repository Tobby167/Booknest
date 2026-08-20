-- Migration: 020_admin_crm_fields
-- Description: Adds admin CRM fields such as is_banned to the businesses table

ALTER TABLE public.businesses
  ADD COLUMN is_banned boolean NOT NULL DEFAULT false,
  ADD COLUMN ban_reason text NULL;
