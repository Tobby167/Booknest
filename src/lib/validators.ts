import { z } from "zod";

const priceTypeSchema = z.enum(["fixed", "varies", "free"]);
const couponAudienceSchema = z.enum(["everyone", "new_clients", "models", "special_people", "client_group"]);
const couponDiscountTypeSchema = z.enum(["percent", "fixed"]);
const serviceDiscountTypeSchema = z.enum(["percent", "fixed", "special_price"]);

export const businessSettingsSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().or(z.literal("")).nullable(),
  address: z.string().optional().nullable(),
  logo_url: z.string().url().optional().or(z.literal("")).nullable(),
  bank_name: z.string().optional().nullable(),
  bank_account_name: z.string().optional().nullable(),
  bank_account_number: z.string().optional().nullable(),
  booking_requires_owner_confirmation: z.boolean().default(true),
  currency: z.string().regex(/^[A-Z]{3}$/).default("USD"),
  timezone: z.string().min(2).default("America/Chicago"),
  cancellation_policy: z.string().optional().nullable(),
  default_deposit_required: z.boolean().default(false),
  default_deposit_amount: z.coerce.number().nullable().optional(),
  booking_notice_hours: z.coerce.number().int().min(0).default(0),
  max_advance_booking_days: z.coerce.number().int().min(1).max(730).default(90),
  default_buffer_after_minutes: z.coerce.number().int().min(0).max(720).default(0)
});

export const serviceCategorySchema = z.object({
  business_id: z.string().uuid(),
  name: z.string().min(2),
  description: z.string().optional().nullable(),
  display_order: z.coerce.number().int().default(0),
  is_active: z.boolean().default(true)
});

export const serviceSchema = z.object({
  business_id: z.string().uuid(),
  category_id: z.string().uuid().nullable().optional(),
  name: z.string().min(2),
  description: z.string().optional().nullable(),
  base_price: z.coerce.number().nullable().optional(),
  price_type: priceTypeSchema.default("fixed"),
  duration_minutes: z.coerce.number().int().positive().nullable().optional(),
  deposit_required: z.boolean().default(false),
  deposit_amount: z.coerce.number().nullable().optional(),
  buffer_before_minutes: z.coerce.number().int().min(0).default(0),
  buffer_after_minutes: z.coerce.number().int().min(0).default(0),
  display_order: z.coerce.number().int().default(0),
  is_active: z.boolean().default(true)
});

export const serviceOptionSchema = z.object({
  business_id: z.string().uuid(),
  service_id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  price: z.coerce.number().nullable().optional(),
  price_type: priceTypeSchema.default("fixed"),
  duration_minutes: z.coerce.number().int().positive().nullable().optional(),
  display_order: z.coerce.number().int().default(0),
  is_active: z.boolean().default(true)
});

export const serviceAddonSchema = z.object({
  business_id: z.string().uuid(),
  service_id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  price: z.coerce.number().nullable().optional(),
  price_type: priceTypeSchema.default("fixed"),
  duration_minutes: z.coerce.number().int().min(0).default(0),
  is_active: z.boolean().default(true)
});

export const availabilitySchema = z.object({
  business_id: z.string().uuid(),
  day_of_week: z.coerce.number().int().min(0).max(6),
  start_time: z.string().regex(/^\d{2}:\d{2}/),
  end_time: z.string().regex(/^\d{2}:\d{2}/),
  is_available: z.boolean().default(true)
});

export const createAppointmentSchema = z.object({
  businessSlug: z.string().min(1),
  serviceId: z.string().uuid(),
  serviceOptionId: z.string().uuid().nullable().optional(),
  addonIds: z.array(z.string().uuid()).default([]),
  appointmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}/),
  clientName: z.string().min(2),
  clientEmail: z.string().email().optional().or(z.literal("")),
  clientPhone: z.string().min(5).optional().or(z.literal("")),
  couponCode: z.string().max(32).optional().or(z.literal("")),
  notes: z.string().optional().nullable(),
  receiptImageUrl: z.string().url().optional().or(z.literal("")).nullable(),
  formAnswers: z.array(z.object({ question_id: z.string().uuid(), answer: z.string() })).default([])
});

export const couponSchema = z.object({
  business_id: z.string().uuid(),
  service_id: z.string().uuid().nullable().optional(),
  service_option_id: z.string().uuid().nullable().optional(),
  code: z
    .string()
    .min(2)
    .max(31)
    .transform((value) => value.trim().toUpperCase())
    .refine((value) => /^[A-Z0-9][A-Z0-9_-]{1,30}$/.test(value), "Use only letters, numbers, hyphen, or underscore."),
  name: z.string().min(2),
  description: z.string().optional().nullable(),
  discount_type: couponDiscountTypeSchema.default("percent"),
  discount_value: z.coerce.number().positive(),
  audience: couponAudienceSchema.default("everyone"),
  target_client_group_id: z.string().uuid().nullable().optional(),
  requires_login: z.boolean().default(false),
  requires_owner_approval: z.boolean().default(false),
  starts_at: z.string().datetime().optional().or(z.literal("")).nullable(),
  ends_at: z.string().datetime().optional().or(z.literal("")).nullable(),
  max_redemptions: z.coerce.number().int().positive().nullable().optional(),
  max_redemptions_per_client: z.coerce.number().int().positive().default(1),
  is_active: z.boolean().default(true)
});

export const couponValidateSchema = z.object({
  businessSlug: z.string().min(1),
  code: z.string().min(2).max(31),
  serviceId: z.string().uuid().nullable().optional(),
  serviceOptionId: z.string().uuid().nullable().optional(),
  clientName: z.string().optional().or(z.literal("")),
  clientEmail: z.string().email().optional().or(z.literal("")),
  clientPhone: z.string().optional().or(z.literal("")),
  totalPrice: z.coerce.number().nullable().optional()
});

export const serviceDiscountSchema = z.object({
  business_id: z.string().uuid(),
  service_id: z.string().uuid(),
  service_option_id: z.string().uuid().nullable().optional(),
  name: z.string().min(2),
  description: z.string().optional().nullable(),
  discount_type: serviceDiscountTypeSchema.default("percent"),
  discount_value: z.coerce.number().min(0),
  audience: couponAudienceSchema.default("everyone"),
  target_client_group_id: z.string().uuid().nullable().optional(),
  starts_at: z.string().datetime().optional().or(z.literal("")).nullable(),
  ends_at: z.string().datetime().optional().or(z.literal("")).nullable(),
  max_redemptions: z.coerce.number().int().positive().nullable().optional(),
  is_active: z.boolean().default(true)
});

export const serviceDiscountPreviewSchema = z.object({
  businessSlug: z.string().min(1),
  serviceId: z.string().uuid(),
  serviceOptionId: z.string().uuid().nullable().optional(),
  totalPrice: z.coerce.number().nullable().optional(),
  clientName: z.string().optional().or(z.literal("")),
  clientEmail: z.string().email().optional().or(z.literal("")),
  clientPhone: z.string().optional().or(z.literal(""))
});
