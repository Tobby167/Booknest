export type Role = "business_owner" | "staff" | "client" | "admin";
export type PriceType = "fixed" | "varies" | "free";
export type CouponDiscountType = "percent" | "fixed";
export type ServiceDiscountType = "percent" | "fixed" | "special_price";
export type CouponAudience = "everyone" | "new_clients" | "models" | "special_people" | "client_group";
export type DiscountAudience = CouponAudience;
export type BusinessClientType = "regular" | "new_client" | "model" | "special_person" | "vip";
export type AppointmentStatus =
  | "pending"
  | "pending_confirmation"
  | "confirmed"
  | "cancelled"
  | "rescheduled"
  | "completed"
  | "no_show";
export type PaymentStatus = "not_required" | "pending" | "receipt_uploaded" | "confirmed" | "rejected";

export type Business = {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  description: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  logo_url: string | null;
  bank_name: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  booking_requires_owner_confirmation: boolean;
  currency?: string | null;
  timezone?: string | null;
  cancellation_policy?: string | null;
  default_deposit_required?: boolean;
  default_deposit_amount?: number | null;
  booking_notice_hours?: number;
  max_advance_booking_days?: number;
  default_buffer_after_minutes?: number;
};

export type ServiceCategory = {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
};

export type Service = {
  id: string;
  business_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  base_price: number | null;
  price_type: PriceType;
  duration_minutes: number | null;
  deposit_required: boolean;
  deposit_amount: number | null;
  buffer_before_minutes: number;
  buffer_after_minutes: number;
  is_active: boolean;
  display_order: number;
};

export type ServiceOption = {
  id: string;
  business_id: string;
  service_id: string;
  name: string;
  description: string | null;
  price: number | null;
  price_type: PriceType;
  duration_minutes: number | null;
  is_active: boolean;
  display_order: number;
};

export type ServiceAddon = {
  id: string;
  business_id: string;
  service_id: string;
  name: string;
  description: string | null;
  price: number | null;
  price_type: PriceType;
  duration_minutes: number;
  is_active: boolean;
};

export type Availability = {
  id: string;
  business_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
};

export type BlockedDate = {
  id: string;
  business_id: string;
  date: string;
  reason?: string | null;
};

export type BlockedTime = {
  id: string;
  business_id: string;
  date: string;
  start_time: string;
  end_time: string;
  reason?: string | null;
  created_at?: string;
};

export type Appointment = {
  id: string;
  business_id: string;
  service_id: string | null;
  service_option_id: string | null;
  client_id: string | null;
  client_auth_user_id?: string | null;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: AppointmentStatus;
  payment_status: PaymentStatus;
  total_price: number | null;
  coupon_id?: string | null;
  coupon_code?: string | null;
  discount_amount?: number;
  original_total_price?: number | null;
  service_discount_id?: string | null;
  service_discount_name?: string | null;
  service_discount_amount?: number;
  notes: string | null;
  created_at: string;
};

export type Coupon = {
  id: string;
  business_id: string;
  service_id?: string | null;
  service_option_id?: string | null;
  code: string;
  name: string;
  description: string | null;
  discount_type: CouponDiscountType;
  discount_value: number;
  audience: CouponAudience;
  target_client_group_id?: string | null;
  requires_login: boolean;
  requires_owner_approval: boolean;
  starts_at: string | null;
  ends_at: string | null;
  max_redemptions: number | null;
  max_redemptions_per_client: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CouponRedemption = {
  id: string;
  business_id: string;
  coupon_id: string;
  appointment_id: string | null;
  client_auth_user_id: string | null;
  client_name: string | null;
  client_email: string | null;
  client_phone: string | null;
  original_total: number | null;
  discount_amount: number;
  final_total: number | null;
  status: "applied" | "pending_owner_approval" | "rejected";
  created_at: string;
};

export type ServiceDiscount = {
  id: string;
  business_id: string;
  service_id: string;
  service_option_id: string | null;
  name: string;
  description: string | null;
  discount_type: ServiceDiscountType;
  discount_value: number;
  audience: DiscountAudience;
  target_client_group_id?: string | null;
  starts_at: string | null;
  ends_at: string | null;
  max_redemptions: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ServiceDiscountRedemption = {
  id: string;
  business_id: string;
  service_discount_id: string;
  appointment_id: string | null;
  client_auth_user_id: string | null;
  client_name: string | null;
  client_email: string | null;
  client_phone: string | null;
  original_total: number | null;
  discount_amount: number;
  final_total: number | null;
  created_at: string;
};

export type BusinessClient = {
  id: string;
  business_id: string;
  auth_user_id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  client_type: BusinessClientType;
  is_approved: boolean;
  created_at: string;
};

export type ClientGroup = {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type Payment = {
  id: string;
  appointment_id: string;
  business_id: string;
  amount: number | null;
  method: string;
  receipt_image_url: string | null;
  status: Exclude<PaymentStatus, "not_required">;
  provider?: string | null;
  provider_payment_id?: string | null;
  provider_checkout_session_id?: string | null;
  provider_checkout_url?: string | null;
  provider_currency?: string | null;
  provider_metadata?: unknown;
  confirmed_by: string | null;
  confirmed_at: string | null;
  created_at: string;
};

export type BookingCatalog = {
  business: Business;
  categories: ServiceCategory[];
  services: Service[];
  options: ServiceOption[];
  addons: ServiceAddon[];
  discounts?: ServiceDiscount[];
  availability: Availability[];
  blockedDates: BlockedDate[];
  blockedTimes?: BlockedTime[];
  formQuestions: FormQuestion[];
};

export type FormQuestion = {
  id: string;
  business_id: string;
  service_id: string | null;
  question: string;
  field_type: string | null;
  is_required: boolean;
  options: unknown;
};
