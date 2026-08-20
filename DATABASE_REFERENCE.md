# BookNest — Complete Database Reference

**Database engine:** PostgreSQL (via Supabase)
**Total tables:** 25 (public schema) + auth.users (managed by Supabase)
**Total RPCs:** 3 callable + 1 internal utility
**Total triggers:** 5
**Total migrations:** 22 (001 – 022)
**Row Level Security:** enabled on every table

---

## Table of Contents

1. [Entity-Relationship Overview](#entity-relationship-overview)
2. [Core Tables](#core-tables)
   - [auth.users](#authusers)
   - [profiles](#profiles)
   - [businesses](#businesses)
3. [Service Catalog](#service-catalog)
   - [service_categories](#service_categories)
   - [services](#services)
   - [service_options](#service_options)
   - [service_addons](#service_addons)
4. [Scheduling](#scheduling)
   - [availability](#availability)
   - [blocked_dates](#blocked_dates)
   - [blocked_times](#blocked_times)
5. [Clients & CRM](#clients--crm)
   - [clients](#clients)
   - [client_groups](#client_groups)
   - [client_group_members](#client_group_members)
6. [Appointments](#appointments)
   - [appointments](#appointments-table)
   - [appointment_addons](#appointment_addons)
7. [Payments & Discounts](#payments--discounts)
   - [payments](#payments)
   - [coupons](#coupons)
   - [coupon_redemptions](#coupon_redemptions)
   - [service_discounts](#service_discounts)
   - [service_discount_redemptions](#service_discount_redemptions)
8. [Booking Forms](#booking-forms)
   - [form_questions](#form_questions)
   - [form_answers](#form_answers)
9. [Notifications & Audit](#notifications--audit)
   - [notifications](#notifications)
   - [audit_logs](#audit_logs)
   - [admin_broadcasts](#admin_broadcasts)
10. [Messaging Integrations](#messaging-integrations)
    - [telegram_integrations](#telegram_integrations)
    - [whatsapp_integrations](#whatsapp_integrations)
    - [chat_conversations](#chat_conversations)
    - [chat_messages](#chat_messages)
11. [Functions & RPCs](#functions--rpcs)
12. [Triggers](#triggers)
13. [Row Level Security Policies](#row-level-security-policies)
14. [Indexes](#indexes)
15. [Storage Buckets](#storage-buckets)
16. [Migration History](#migration-history)
17. [Unused / Partially Used Tables](#unused--partially-used-tables)
18. [Identified Issues & Improvements](#identified-issues--improvements)

---

## Entity-Relationship Overview

```
auth.users
  └── profiles (1:1)
        └── businesses (1:N, owner_id)
              ├── service_categories (1:N)
              ├── services (1:N)
              │     ├── service_options (1:N)
              │     └── service_addons (1:N)
              ├── availability (1:N, per day_of_week)
              ├── blocked_dates (1:N)
              ├── blocked_times (1:N)
              ├── clients (1:N)
              │     └── client_group_members (N:M via client_groups)
              ├── appointments (1:N)
              │     ├── appointment_addons (1:N)
              │     ├── form_answers (1:N)
              │     ├── payments (1:1 usually)
              │     ├── coupons (FK)
              │     └── service_discounts (FK)
              ├── coupons (1:N)
              │     └── coupon_redemptions (1:N)
              ├── service_discounts (1:N)
              │     └── service_discount_redemptions (1:N)
              ├── form_questions (1:N)
              ├── notifications (1:N)
              ├── audit_logs (1:N)
              ├── telegram_integrations (1:1)
              ├── whatsapp_integrations (1:1)
              └── chat_conversations (1:N)
                    └── chat_messages (1:N)
```

---

## Core Tables

### auth.users

**Managed by:** Supabase Auth. Not directly editable via migrations.

| Column | Type | Purpose |
|---|---|---|
| id | uuid PK | Global user identity — the FK anchor for the entire system |
| email | text | Login credential |
| raw_user_meta_data | jsonb | Stores `full_name` and `role` on signup |

**Why it exists:** Supabase Auth owns the identity layer. All first-party tables reference `auth.users(id)`.

**Written by:** Supabase Auth on signup / social login
**Read by:** `handle_new_user()` trigger, `AuthCard.tsx`, all JWT-based RLS policies via `auth.uid()`

---

### profiles

**Migration:** 001 | **RLS:** enabled

| Column | Type | Constraints | Purpose |
|---|---|---|---|
| id | uuid PK | FK → `auth.users(id)` ON DELETE CASCADE | Links to the Supabase auth user |
| full_name | text | nullable | Display name shown in dashboard |
| email | text | nullable | Copied from auth on signup |
| role | text | NOT NULL, CHECK `('business_owner','staff','client','admin')`, default `'business_owner'` | Controls access level throughout the app |
| created_at | timestamptz | NOT NULL, default now() | Audit timestamp |

**Why it exists:** Supabase Auth cannot be extended directly. `profiles` carries application-level metadata (role, full_name) that the app needs to enforce RBAC.

**Written by:**
- `handle_new_user()` trigger (on every `auth.users` INSERT)
- `AuthCard.tsx` (via `supabase.auth.signUp` + trigger)

**Read by:**
- `AuthCard.tsx` → `select role` for post-login redirect
- `current_user_role()` SQL function → feeds `is_admin()` and `owns_business()`
- RLS policies on every table

**Relationships:**
- 1:1 with `auth.users`
- Referenced by `businesses.owner_id`, `payments.confirmed_by`, `notifications.user_id`

---

### businesses

**Migration:** 001 (base), 005 (booking rules), 007 (cleanup buffer), 018 (whatsapp), 019 (subscriptions), 020 (admin CRM) | **RLS:** enabled

| Column | Type | Constraints | Purpose |
|---|---|---|---|
| id | uuid PK | gen_random_uuid() | Business identity |
| owner_id | uuid | NOT NULL, FK → `profiles(id)` ON DELETE CASCADE | Links business to its owner |
| name | text | NOT NULL | Display name |
| slug | text | UNIQUE, NOT NULL | URL-safe identifier used in `/book/[slug]` and all RPCs |
| description | text | nullable | Public-facing description |
| phone / email / address | text | nullable | Contact info |
| logo_url | text | nullable | Storage reference (business-logos bucket) |
| bank_name / bank_account_name / bank_account_number | text | nullable | Bank transfer details for manual payments |
| booking_requires_owner_confirmation | boolean | NOT NULL, default true | If true → new bookings land in `pending` status |
| currency | text | NOT NULL, default 'USD', CHECK `^[A-Z]{3}$` | 3-letter ISO currency code |
| timezone | text | NOT NULL, default 'America/Chicago' | Owner's timezone (**NOTE: not yet enforced by booking engine**) |
| cancellation_policy | text | nullable | Shown to clients on booking page |
| default_deposit_required | boolean | NOT NULL, default false | Business-wide deposit toggle |
| default_deposit_amount | numeric | nullable | Default deposit amount |
| booking_notice_hours | integer | NOT NULL, default 0, CHECK >= 0 | Minimum hours required before a booking can be made |
| max_advance_booking_days | integer | NOT NULL, default 90, CHECK 1–730 | How far in advance a client can book |
| default_buffer_after_minutes | integer | NOT NULL, default 0, CHECK 0–720 | Business-wide cleanup time appended after every appointment |
| whatsapp_enabled | boolean | NOT NULL, default false | Enables shared-platform WhatsApp booking |
| plan | text | NOT NULL, default 'starter' | Subscription plan tier |
| trial_ends_at | timestamptz | nullable | Populated by `on_business_created_trial` trigger |
| subscription_status | text | nullable | e.g., `'trialing'`, `'active'`, `'cancelled'` |
| is_lifetime | boolean | NOT NULL, default false | Marks lifetime deal accounts |
| subscription_id | text | nullable | External Stripe/Paystack subscription reference |
| stripe_customer_id | text | nullable | Stripe customer reference |
| paystack_customer_code | text | nullable | Paystack customer reference |
| is_banned | boolean | NOT NULL, default false | Admin-imposed ban |
| ban_reason | text | nullable | Admin ban note |
| created_at | timestamptz | NOT NULL, default now() | |

**Why it exists:** The central entity of the platform. Every other table fans out from `business_id`. The slug is the public URL key used by booking pages and all RPC calls.

**Written by:**
- `src/app/api/business/route.ts` (owner INSERT)
- `on_business_created_trial` trigger (auto-populates plan/trial on INSERT)
- `trigger_log_new_business` trigger (creates audit_log entry)
- Admin dashboard for bans

**Read by:**
- Every RLS policy via `owns_business()`
- `create_public_booking()` RPC (slug lookup)
- `/api/slots` (booking rules fetch)
- `/api/appointments` (booking rules, notice/advance checks)
- Dashboard layout, all dashboard pages

**Indexes:**
- `businesses_owner_idx` on `(owner_id)`
- `businesses_slug_idx` on `(slug)`

---

## Service Catalog

### service_categories

**Migration:** 001 | **RLS:** enabled

| Column | Type | Constraints | Purpose |
|---|---|---|---|
| id | uuid PK | | |
| business_id | uuid | NOT NULL, FK → businesses | Scopes to business |
| name | text | NOT NULL | Category label |
| description | text | nullable | |
| display_order | integer | NOT NULL, default 0 | Sort order in booking UI |
| is_active | boolean | NOT NULL, default true | Soft-delete / toggle |
| created_at | timestamptz | | |

**Why it exists:** Groups services visually on the booking page.

**Written by:** Owner dashboard via `/api/services/categories` routes
**Read by:** Booking page service list, dashboard service management
**Index:** `service_categories_business_idx` on `(business_id, display_order)`

---

### services

**Migration:** 001 | **RLS:** enabled

| Column | Type | Constraints | Purpose |
|---|---|---|---|
| id | uuid PK | | |
| business_id | uuid | NOT NULL, FK → businesses | |
| category_id | uuid | FK → service_categories ON DELETE SET NULL | Optional grouping |
| name | text | NOT NULL | Service label |
| description | text | nullable | |
| base_price | numeric | nullable | Price when no option selected |
| price_type | text | NOT NULL, CHECK `('fixed','varies','free')` | Controls price display and calculation |
| duration_minutes | integer | nullable | Service duration; fallback 60 min in RPC |
| deposit_required | boolean | NOT NULL, default false | If true → payment flow triggered at booking |
| deposit_amount | numeric | nullable | Amount due as deposit |
| buffer_before_minutes | integer | NOT NULL, default 0 | Dead time before appointment (setup) |
| buffer_after_minutes | integer | NOT NULL, default 0 | Dead time after appointment (cleanup) |
| is_active | boolean | NOT NULL, default true | Hides from public booking |
| display_order | integer | NOT NULL, default 0 | Sort order |
| created_at | timestamptz | | |

**Why it exists:** The bookable unit. Every appointment must reference a service.

**Written by:** Owner dashboard `/api/services` routes
**Read by:**
- `create_public_booking()` RPC (validates, calculates price/duration)
- `get_booked_appointment_ranges()` RPC (reads buffer columns for slot generation)
- Booking page UI
- `getBookingDurationMinutes()` in `src/lib/booking/availability.ts`

**Index:** `services_business_idx` on `(business_id, display_order)`

---

### service_options

**Migration:** 001 | **RLS:** enabled

| Column | Type | Purpose |
|---|---|---|
| id | uuid PK | |
| business_id / service_id | uuid FK | Scoped to business and service |
| name | text | Variant label (e.g. "1 hour", "2 hours") |
| price / price_type | numeric / text | Overrides service price when selected |
| duration_minutes | integer | Overrides service duration when selected |
| is_active / display_order | | |

**Why it exists:** Allows one service to have multiple price/duration variants without duplicating the service.

**Read by:** `create_public_booking()`, booking UI, `getBookingDurationMinutes()`
**Index:** `service_options_service_idx` on `(service_id, display_order)`

---

### service_addons

**Migration:** 001 | **RLS:** enabled

| Column | Type | Purpose |
|---|---|---|
| id | uuid PK | |
| business_id / service_id | uuid FK | |
| name / description | text | Add-on label |
| price / price_type | numeric / text | Added to base price |
| duration_minutes | integer | Added to service duration |
| is_active | boolean | |

**Why it exists:** Optional extras clients can bolt onto a service (e.g. "+30 min deep conditioning"). Both price and duration accumulate.

**Read by:** `create_public_booking()`, booking UI, `getBookingDurationMinutes()`, `getBookingPrice()`
**Written to:** `appointment_addons` at booking time
**Index:** `service_addons_service_idx` on `(service_id)`

---

## Scheduling

### availability

**Migration:** 001 | **RLS:** enabled

| Column | Type | Constraints | Purpose |
|---|---|---|---|
| id | uuid PK | | |
| business_id | uuid | NOT NULL, FK → businesses | |
| day_of_week | integer | NOT NULL, CHECK 0–6 (Sun=0) | Day of the week |
| start_time | time | NOT NULL | Window open |
| end_time | time | NOT NULL | Window close |
| is_available | boolean | NOT NULL, default true | Marks day as closed when false |
| — | — | CHECK end_time > start_time | Integrity constraint |

**Why it exists:** Defines which hours are bookable per day. If no row exists for a day, the system falls back to 09:00–18:00 (see migration 003).

**Read by:**
- `create_public_booking()` RPC (enforces time windows)
- `generateAvailableSlots()` in `src/lib/booking/availability.ts`

**Written by:** Owner dashboard availability settings

---

### blocked_dates

**Migration:** 001 | **RLS:** enabled

| Column | Type | Purpose |
|---|---|---|
| id / business_id | uuid | |
| date | date NOT NULL | The fully blocked date |
| reason | text | Optional explanation shown to owner |

**Why it exists:** Blocks an entire day. Higher priority than `availability`. Takes precedence in both `create_public_booking()` and `generateAvailableSlots()`.

---

### blocked_times

**Migration:** 008 | **RLS:** enabled

| Column | Type | Constraints | Purpose |
|---|---|---|---|
| id / business_id | uuid | | |
| date | date | NOT NULL | Specific date |
| start_time / end_time | time | NOT NULL, CHECK end > start | The blocked range |
| reason | text | nullable | |
| created_at | timestamptz | | |

**Why it exists:** Finer-grained than `blocked_dates` — blocks a time range on a specific date (e.g. "lunch break 12:00–13:00 on Friday").

**Read by:** `create_public_booking()` RPC (overlap check), `generateAvailableSlots()`
**Index:** `blocked_times_business_date_idx` on `(business_id, date, start_time)`

---

## Clients & CRM

### clients

**Migration:** 001 (base), 013 (auth_user_id, client_type, is_approved) | **RLS:** enabled

| Column | Type | Constraints | Purpose |
|---|---|---|---|
| id | uuid PK | | |
| business_id | uuid | NOT NULL, FK → businesses | Scopes to business (clients are not platform-wide) |
| auth_user_id | uuid | FK → auth.users ON DELETE SET NULL | Links to a logged-in client account (nullable for walk-ins) |
| name | text | NOT NULL | Client display name |
| email / phone | text | nullable | Used for deduplication in RPC |
| client_type | text | NOT NULL, CHECK `('regular','new_client','model','special_person','vip')`, default 'regular' | Used for coupon/discount audience targeting |
| is_approved | boolean | NOT NULL, default false | Marks approved models / special clients |
| created_at | timestamptz | | |

**Why it exists:** CRM record. Each booking creates or updates a client record. Deduplication is by email OR phone within a business.

**Written by:**
- `create_public_booking()` RPC (upsert by email/phone)
- `/api/appointments` route.ts (links logged-in user to client record post-booking)

**Read by:**
- Owner CRM dashboard
- Coupon and discount audience validation (`src/lib/coupons.ts`, `src/lib/service-discounts.ts`)
- Telegram bot (`bookingAutomation.ts`)

**Indexes:**
- `clients_auth_user_idx` on `(auth_user_id)`
- `clients_business_auth_user_idx` on `(business_id, auth_user_id)`

**RLS policies:**
- `clients_owner_read` — owner can SELECT
- `clients_owner_all` — owner can do all operations
- `clients_client_read_own` — logged-in client can read their own record

---

### client_groups

**Migration:** 015 | **RLS:** enabled

| Column | Type | Purpose |
|---|---|---|
| id | uuid PK | |
| business_id | uuid FK | Scoped to business |
| name | text NOT NULL | Group label (UNIQUE per business) |
| description | text | |
| created_at / updated_at | timestamptz | |

**Why it exists:** Lets owners create named lists (e.g. "VIP Club", "Influencers") and target coupons or discounts exclusively to those clients.

**Read by:** Coupon/discount validation, owner CRM dashboard
**Index:** `client_groups_business_idx` on `(business_id, name)`

---

### client_group_members

**Migration:** 015 | **RLS:** enabled

| Column | Type | Constraints | Purpose |
|---|---|---|---|
| id | uuid PK | | |
| business_id | uuid FK | | |
| client_id | uuid | FK → clients ON DELETE CASCADE | |
| client_group_id | uuid | FK → client_groups ON DELETE CASCADE | |
| created_at | timestamptz | | |
| — | — | UNIQUE (client_id, client_group_id) | Prevents duplicate membership |

**Why it exists:** Join table for the N:M relationship between clients and groups.

**Indexes:**
- `client_group_members_business_group_idx` on `(business_id, client_group_id)`
- `client_group_members_client_idx` on `(client_id)`

---

## Appointments

### appointments (table)

**Migration:** 001 (base), 012 (coupon columns), 013 (client_auth_user_id), 014 (discount columns) | **RLS:** enabled

| Column | Type | Constraints | Purpose |
|---|---|---|---|
| id | uuid PK | | |
| business_id | uuid | NOT NULL, FK → businesses | |
| service_id | uuid | FK → services (nullable: service deleted?) | |
| service_option_id | uuid | FK → service_options | Optional variant |
| client_id | uuid | FK → clients | CRM link |
| client_auth_user_id | uuid | FK → auth.users ON DELETE SET NULL | Links logged-in client; used for client portal reads |
| client_name | text | NOT NULL | Denormalized for display without joining clients |
| client_email / client_phone | text | nullable | Denormalized for display |
| appointment_date | date | NOT NULL | |
| start_time | time | NOT NULL | |
| end_time | time | NOT NULL | Calculated by RPC: start + duration |
| status | text | NOT NULL, CHECK `('pending','pending_confirmation','confirmed','cancelled','rescheduled','completed','no_show')`, default 'pending' | Lifecycle state |
| payment_status | text | NOT NULL, CHECK `('not_required','pending','receipt_uploaded','confirmed','rejected')`, default 'not_required' | Payment sub-state |
| total_price | numeric | nullable | Final price (after discounts/coupons) |
| original_total_price | numeric | nullable | Price before discount |
| notes | text | nullable | Client notes |
| coupon_id | uuid | FK → coupons ON DELETE SET NULL | |
| coupon_code | text | nullable | Denormalized code at redemption time |
| discount_amount | numeric | NOT NULL, default 0 | Coupon discount value |
| service_discount_id | uuid | FK → service_discounts ON DELETE SET NULL | |
| service_discount_name | text | nullable | Denormalized at booking time |
| service_discount_amount | numeric | default 0 | Auto-applied discount amount |
| created_at | timestamptz | NOT NULL | |
| — | — | CHECK end_time > start_time | |

**Why it exists:** The operational core of the system. Every booking creates a row. Status transitions (pending → confirmed, etc.) drive the entire workflow.

**Written by:**
- `create_public_booking()` RPC (INSERT)
- `/api/appointments/[id]/status/route.ts` (status UPDATE)
- `/api/appointments/[id]/route.ts` (soft-cancel via status UPDATE)
- `bookingAutomation.ts` via Telegram (reschedule UPDATE)
- `stripe-webhook/route.ts` (payment_status UPDATE)

**Read by:**
- Dashboard appointments panel
- `/api/dashboard/summary` (counts)
- `bookingAutomation.ts` (upcoming appointments for cancel/reschedule menus)
- Client portal (`/client/appointments`)
- `get_booked_appointment_ranges()` RPC (for slot exclusion)

**Indexes:**
- `appointments_business_date_idx` on `(business_id, appointment_date, start_time)`
- `appointments_coupon_idx` on `(coupon_id)`
- `appointments_client_auth_user_idx` on `(client_auth_user_id, appointment_date, start_time)`

**Status state machine:**
```
pending ──────────────── confirmed
   │                         │
   ├── pending_confirmation   │
   │         │               │
   │         └── confirmed   │
   │                         │
   ├── cancelled ◄────────────┤
   ├── rescheduled            │
   ├── completed ◄────────────┤
   └── no_show  ◄────────────┘
```

---

### appointment_addons

**Migration:** 001 | **RLS:** enabled

| Column | Type | Purpose |
|---|---|---|
| id | uuid PK | |
| appointment_id | uuid | FK → appointments ON DELETE CASCADE |
| addon_id | uuid | FK → service_addons (nullable; addon may be deleted) |
| addon_name | text | Denormalized at booking time |
| addon_price | numeric | Snapshot price at booking time |

**Why it exists:** Records exactly which addons were selected at booking, with prices snapshotted so future price changes don't alter historical records.

**Written by:** `create_public_booking()` RPC
**Read by:** Appointment detail view (`select *, appointment_addons(*)`)

---

## Payments & Discounts

### payments

**Migration:** 001 (base), 004 (Stripe columns) | **RLS:** enabled

| Column | Type | Constraints | Purpose |
|---|---|---|---|
| id | uuid PK | | |
| appointment_id | uuid | NOT NULL, FK → appointments ON DELETE CASCADE | |
| business_id | uuid | NOT NULL, FK → businesses | For owner RLS |
| amount | numeric | nullable | Payment amount |
| method | text | NOT NULL, default 'bank_transfer' | `'bank_transfer'`, `'stripe'`, etc. |
| receipt_image_url | text | nullable | Path in `payment-receipts` bucket |
| status | text | NOT NULL, CHECK `('pending','receipt_uploaded','confirmed','rejected')` | Payment lifecycle |
| confirmed_by | uuid | FK → profiles | Who approved the payment |
| confirmed_at | timestamptz | nullable | When confirmed |
| provider | text | nullable | e.g. `'stripe'` |
| provider_payment_id | text | nullable | Stripe PaymentIntent ID |
| provider_checkout_session_id | text | nullable | Stripe Session ID |
| provider_checkout_url | text | nullable | Redirect URL for Stripe Checkout |
| provider_currency | text | default 'usd' | |
| provider_metadata | jsonb | default `{}` | Raw Stripe metadata |
| created_at | timestamptz | | |

**Why it exists:** Tracks all payment evidence and Stripe session state. One payment per appointment is the typical pattern.

**Written by:**
- `create_public_booking()` RPC (INSERT when deposit required)
- `attach_public_receipt()` RPC (upsert on receipt upload)
- `/api/payments/stripe-checkout/route.ts` (INSERT Stripe payment row)
- `/api/payments/stripe-webhook/route.ts` (UPDATE status = 'confirmed')
- `/api/payments/[id]/confirm/route.ts` (manual confirm)
- `/api/payments/[id]/reject/route.ts` (manual reject)
- `trigger_log_payment_update` trigger (fires on status → confirmed)

**Indexes:**
- `payments_business_idx` on `(business_id, status)`
- `payments_provider_checkout_session_id_idx` on `(provider_checkout_session_id)`

---

### coupons

**Migration:** 012 (base), 015 (target_client_group_id), 016 (service_id, service_option_id) | **RLS:** enabled

| Column | Type | Constraints | Purpose |
|---|---|---|---|
| id | uuid PK | | |
| business_id | uuid | NOT NULL, FK → businesses | Scoped to business |
| code | text | NOT NULL, CHECK `^[A-Z0-9][A-Z0-9_-]{1,30}$`, UNIQUE(business_id, code) | Promotion code |
| name / description | text | | Display info |
| discount_type | text | CHECK `('percent','fixed')` | How the discount is applied |
| discount_value | numeric | CHECK >= 0 | Magnitude of discount |
| audience | text | CHECK `('everyone','new_clients','models','special_people','client_group')` | Who can redeem |
| requires_login | boolean | default false | If true, client must be signed in |
| requires_owner_approval | boolean | default false | Approval-gated discount |
| starts_at / ends_at | timestamptz | nullable, CHECK starts < ends | Validity window |
| max_redemptions | integer | nullable, CHECK > 0 | Global usage cap |
| max_redemptions_per_client | integer | default 1, CHECK > 0 | Per-client usage cap |
| service_id | uuid | FK → services ON DELETE SET NULL | Limit to specific service |
| service_option_id | uuid | FK → service_options ON DELETE SET NULL | Limit to specific option |
| target_client_group_id | uuid | FK → client_groups ON DELETE SET NULL | Limit to group |
| is_active | boolean | NOT NULL, default true | Toggle |
| created_at / updated_at | timestamptz | | |

**Why it exists:** Code-based promotions ("fastest finger" model). Client enters a code at checkout; the system validates eligibility server-side.

**Read by:** `validateCoupon()` in `src/lib/coupons.ts` (called from `/api/appointments`)

---

### coupon_redemptions

**Migration:** 012 | **RLS:** enabled

| Column | Type | Purpose |
|---|---|---|
| id | uuid PK | |
| business_id / coupon_id | uuid FK | |
| appointment_id | uuid | FK → appointments ON DELETE SET NULL |
| client_auth_user_id | uuid | FK → auth.users |
| client_name / email / phone | text | Snapshot at redemption |
| original_total / discount_amount / final_total | numeric | Price breakdown |
| status | text | CHECK `('applied','pending_owner_approval','rejected')` |
| created_at | timestamptz | |

**Why it exists:** Audit trail for every coupon use. Used to enforce `max_redemptions` and `max_redemptions_per_client`.

---

### service_discounts

**Migration:** 014 (base), 015 (target_client_group_id) | **RLS:** enabled

| Column | Type | Constraints | Purpose |
|---|---|---|---|
| id | uuid PK | | |
| business_id / service_id | uuid FK | NOT NULL | |
| service_option_id | uuid | FK → service_options (nullable) | Optional option scoping |
| name / description | text | | |
| discount_type | text | CHECK `('percent','fixed','special_price')` | |
| discount_value | numeric | CHECK >= 0 | |
| audience | text | CHECK `('everyone','new_clients','models','special_people','client_group')` | |
| starts_at / ends_at | timestamptz | nullable | |
| max_redemptions | integer | nullable | |
| target_client_group_id | uuid | FK → client_groups | |
| is_active / created_at / updated_at | | | |

**Why it exists:** Automatic price rules — applied without a code, based on service + audience. Distinct from coupons which require a code.

**Read by:** `findServiceDiscount()` in `src/lib/service-discounts.ts` (called from `/api/appointments`)

---

### service_discount_redemptions

**Migration:** 014 | **RLS:** enabled

Same structure as `coupon_redemptions` but linked to `service_discounts`.

**Why it exists:** Audit trail for auto-applied discounts. Used to enforce `max_redemptions`.

---

## Booking Forms

### form_questions

**Migration:** 001 | **RLS:** enabled

| Column | Type | Purpose |
|---|---|---|
| id | uuid PK | |
| business_id / service_id | uuid FK | Scoped; service_id=null means applies to all services |
| question | text NOT NULL | The question shown on the booking form |
| field_type | text | `'text'`, `'select'`, `'checkbox'`, etc. |
| is_required | boolean | Whether an answer is mandatory |
| options | jsonb | For select/checkbox fields |

**Why it exists:** Allows owners to collect custom information at booking time (e.g. "What is your hair type?").

**Written by:** Owner dashboard forms management
**Read by:** Booking page form rendering, `create_public_booking()` RPC (validates question ownership)

---

### form_answers

**Migration:** 001 | **RLS:** enabled

| Column | Type | Purpose |
|---|---|---|
| id | uuid PK | |
| appointment_id | uuid FK | ON DELETE CASCADE |
| question_id | uuid FK | ON DELETE CASCADE |
| answer | text | Client's response |

**Why it exists:** Stores answers per appointment. Cascade-deleted when appointment is deleted.

**Written by:** `create_public_booking()` RPC

---

## Notifications & Audit

### notifications

**Migration:** 001 | **RLS:** enabled

| Column | Type | Constraints | Purpose |
|---|---|---|---|
| id | uuid PK | | |
| business_id | uuid | NOT NULL, FK → businesses | |
| user_id | uuid | FK → profiles | Target recipient (owner) |
| appointment_id | uuid | FK → appointments ON DELETE CASCADE | Context link |
| type | text | nullable | e.g. `'new_booking'`, `'payment_confirmed'`, `'receipt_uploaded'` |
| title | text | nullable | Notification heading |
| message | text | nullable | Notification body |
| is_read | boolean | NOT NULL, default false | Read state |
| created_at | timestamptz | | |

**Why it exists:** In-app notification inbox for business owners. Drives the notification badge and bell dropdown in the dashboard.

**Written by:**
- `create_public_booking()` RPC (new_booking + receipt_uploaded)
- `attach_public_receipt()` RPC (receipt_uploaded)
- `stripe-webhook/route.ts` (payment_confirmed)

**Read by:** `/api/notifications` routes, dashboard bell component
**Index:** `notifications_user_idx` on `(user_id, is_read, created_at DESC)`

---

### audit_logs

**Migration:** 001 (legacy action/details schema), 021 (event_type/message schema), 022 (unification, dropped action/details) | **RLS:** enabled

| Column | Type | Constraints | Purpose |
|---|---|---|---|
| id | uuid PK | | |
| business_id | uuid | FK → businesses ON DELETE CASCADE | Scopes log to business |
| user_id | uuid | FK → profiles (nullable) | Who triggered the event (may be null for trigger-generated rows) |
| event_type | text | NOT NULL | e.g. `'appointment_booked'`, `'payment_confirmed'`, `'appointment_status_updated'` |
| message | text | NOT NULL | Human-readable description |
| created_at | timestamptz | NOT NULL | |

**Why it exists:** Immutable event log. Used by the admin Activity page and business audit trail. Populated by DB triggers (automatic) and API routes (manual inserts).

**Written by:**
- `trigger_log_new_business` → on businesses INSERT
- `trigger_log_new_appointment` → on appointments INSERT
- `trigger_log_payment_update` → on payments UPDATE (when status → 'confirmed')
- `/api/appointments/[id]/status/route.ts` → manual INSERT on status change
- `/api/payments/[id]/reject/route.ts` → manual INSERT on rejection

**Read by:**
- `/api/admin/activity` route
- Admin dashboard activity page (`src/app/admin/activity/page.tsx`)

**RLS policies:**
- `Admins view audit logs` — admin role only can SELECT (via profiles role check)
- `Businesses view own audit logs` — owner can SELECT their own logs
- `Businesses insert own audit logs` — owner can INSERT

---

### admin_broadcasts

**Migration:** 021 | **RLS:** enabled

| Column | Type | Constraints | Purpose |
|---|---|---|---|
| id | uuid PK | | |
| title | text | NOT NULL | Banner heading |
| message | text | NOT NULL | Banner body |
| tone | text | NOT NULL, default 'blue' | Visual style (`'blue'`, `'amber'`, `'emerald'`, `'red'`) |
| is_active | boolean | NOT NULL, default true | Toggle visibility |
| created_at | timestamptz | | |

**Why it exists:** Platform-wide announcements ("Megaphone") created by super-admins and displayed to all business dashboards.

**Written by:** Admin panel (service-role API)
**Read by:** Dashboard layout header (active broadcasts only)

**RLS policies:**
- `Admins manage broadcasts` — admin profile role can do all operations
- `Anyone can view active broadcasts` — public SELECT on `is_active = true`

---

## Messaging Integrations

### telegram_integrations

**Migration:** 017 | **RLS:** enabled

| Column | Type | Constraints | Purpose |
|---|---|---|---|
| id | uuid PK | | |
| business_id | uuid | NOT NULL, FK → businesses, UNIQUE | One-per-business |
| bot_username | text | NOT NULL | Display name of the bot |
| bot_token_enc | text | NOT NULL | AES-256-CBC encrypted bot token |
| webhook_secret | text | NOT NULL | Signature token for webhook verification |
| is_active | boolean | NOT NULL, default true | Toggle |
| created_at / updated_at | timestamptz | | |

**Why it exists:** Stores the Telegram Bot credentials per business. The webhook handler reads `bot_token_enc`, decrypts at runtime, and uses it to send replies.

**Read by:** `/api/webhooks/telegram/route.ts` on every inbound message
**Written by:** Owner integration settings UI

---

### whatsapp_integrations

**Migration:** 017 | **RLS:** enabled

| Column | Type | Purpose |
|---|---|---|
| id | uuid PK | |
| business_id | uuid | UNIQUE FK |
| phone_number_id / waba_id | text | Meta Business phone and WABA IDs |
| access_token_enc | text | AES-256-CBC encrypted token |
| verify_token | text | Webhook verification token |
| app_secret_enc | text | For HMAC-SHA256 signature validation |
| display_phone | text | Human-readable phone number |
| is_active | boolean | |
| created_at / updated_at | | |

**Why it exists:** Stores per-business WhatsApp Cloud API credentials. Currently parallel to the shared-platform WhatsApp approach (see `businesses.whatsapp_enabled`).

> ⚠️ **Architectural note:** There is a dual WhatsApp approach — per-business credentials (`whatsapp_integrations`) AND a shared platform number (`businesses.whatsapp_enabled`). These may conflict. See [Identified Issues](#identified-issues--improvements).

---

### chat_conversations

**Migration:** 017 | **RLS:** enabled

| Column | Type | Constraints | Purpose |
|---|---|---|---|
| id | uuid PK | | |
| business_id | uuid | FK → businesses | |
| platform | text | CHECK `('whatsapp','telegram')` | Channel identifier |
| external_chat_id | text | NOT NULL | Telegram chat_id or WhatsApp phone |
| client_id | uuid | FK → clients ON DELETE SET NULL | Linked once name is collected |
| client_name | text | nullable | Displayed in conversation list |
| state | jsonb | NOT NULL, default `{"step":"idle"}` | FSM state payload; tracks booking progress |
| last_message_at | timestamptz | NOT NULL | For sorting conversation list |
| created_at | timestamptz | | |
| — | — | UNIQUE (business_id, platform, external_chat_id) | One conversation per customer per channel |

**Why it exists:** Persists the FSM state between webhook calls. Telegram is stateless; the state machine step and data (service chosen, date chosen, etc.) must survive across multiple HTTP requests.

**Written by:** `/api/webhooks/telegram/route.ts` (upsert on every message)
**Read by:** `processMessage()` in `bookingAutomation.ts` (reads and updates state)
**Dashboard:** Shown in Conversations panel

**Indexes:**
- `chat_conversations_business_idx` on `(business_id, platform, last_message_at DESC)`
- `chat_conversations_external_idx` on `(business_id, platform, external_chat_id)`

---

### chat_messages

**Migration:** 017 | **RLS:** enabled

| Column | Type | Constraints | Purpose |
|---|---|---|---|
| id | uuid PK | | |
| conversation_id | uuid | FK → chat_conversations ON DELETE CASCADE | |
| business_id | uuid | FK → businesses | For RLS |
| sender | text | CHECK `('customer','system')` | Who sent it |
| body | text | NOT NULL | Message text |
| external_message_id | text | nullable | Telegram/WhatsApp message ID for idempotency |
| created_at | timestamptz | | |

**Why it exists:** Full conversation history. The `external_message_id` enables deduplication — if the same webhook fires twice, the message is not inserted again.

**Written by:** `/api/webhooks/telegram/route.ts` (incoming + outgoing messages)
**Read by:** Conversations dashboard panel (chat history view)
**Index:** `chat_messages_conversation_idx` on `(conversation_id, created_at ASC)`

---

## Functions & RPCs

### `create_public_booking(...)` — PRIMARY RPC

**Migration:** 001 (v1), 003 (availability fallback), 007 (cleanup buffer), 008 (blocked_times) — each replaces the previous
**Security:** SECURITY DEFINER (runs as owner, bypasses client RLS)
**Granted to:** `anon`, `authenticated`

**Parameters:**
| Parameter | Type | Purpose |
|---|---|---|
| p_business_slug | text | Business lookup key |
| p_service_id | uuid | Selected service |
| p_service_option_id | uuid | Optional variant |
| p_addon_ids | uuid[] | Selected add-ons |
| p_appointment_date | date | Selected date |
| p_start_time | time | Selected start time |
| p_client_name | text | Client identity |
| p_client_email | text | nullable |
| p_client_phone | text | nullable |
| p_notes | text | Client notes |
| p_receipt_image_url | text | nullable, default null |
| p_form_answers | jsonb | default `[]` |

**Returns:** `jsonb { appointment_id, client_id, payment_id, status, payment_status, total_price, end_time }`

**Internal execution sequence:**
1. Lock on `(business_id + date)` with `pg_advisory_xact_lock` — prevents race condition double-bookings
2. Validate: business exists, service active, option active, add-ons valid
3. Price/duration calculation
4. Date guards: not in past, not blocked
5. Time window check: `availability` table (fallback 09:00–18:00 if no rows)
6. `blocked_times` overlap check
7. Existing appointment overlap check (with buffers)
8. Client upsert (by email OR phone)
9. Status/payment_status decision tree
10. INSERT `appointments`
11. INSERT `appointment_addons`
12. INSERT `payments` (if deposit required)
13. INSERT `form_answers`
14. INSERT `notifications` (new_booking)
15. INSERT `notifications` (receipt_uploaded, conditional)
16. RETURN booking data

---

### `get_booked_appointment_ranges(p_business_slug, p_date)` — SLOT EXCLUSION RPC

**Security:** SECURITY DEFINER
**Granted to:** `anon`, `authenticated`

**Purpose:** Returns all blocked time ranges (start/end) for a given business + date, including per-service and business-wide buffers. Called by `generateAvailableSlots()` to exclude occupied slots before presenting options to the client.

**Reads:** `appointments`, `businesses`, `services`
**Returns:** `table(start_time time, end_time time)` — each row is one occupied block

---

### `attach_public_receipt(p_appointment_id, p_receipt_image_url)` — RECEIPT UPSERT RPC

**Migration:** 001 (v1), 002 (repair/re-grant)
**Security:** SECURITY DEFINER
**Granted to:** `anon`, `authenticated`

**Purpose:** Upserts a payment record with receipt URL. Updates appointment status to `pending_confirmation`. Fires a notification. Can be called by anonymous clients (no login required).

**Reads:** `appointments`, `businesses`
**Writes:** `payments` (upsert), `appointments`, `notifications`

---

### `handle_new_user()` — AUTH TRIGGER FUNCTION

**Migration:** 001
**Security:** SECURITY DEFINER

**Purpose:** Automatically creates a `profiles` row when a new Supabase auth user is created. Uses `on conflict (id) do update` — safe to re-run.

**Reads:** `new.raw_user_meta_data` (from Supabase auth)
**Writes:** `profiles`

---

### `current_user_role()` — UTILITY

**Migration:** 001
Returns the `role` text of the currently authenticated user from `profiles`. Stable, security definer.

---

### `is_admin()` — UTILITY

Returns `true` if `current_user_role() = 'admin'`. Used in RLS policies across all tables.

---

### `owns_business(target_business_id)` — UTILITY

Returns `true` if the current user owns `target_business_id` OR is admin. Core RLS building block used on 15+ policies.

---

### `handle_new_business_trial()` — TRIAL TRIGGER FUNCTION

**Migration:** 019
Sets `plan = 'business'`, `trial_ends_at = NOW() + 7 days`, `subscription_status = 'trialing'` on every new business row.

---

### `log_new_business()` / `log_new_appointment()` / `log_payment_update()` — AUDIT TRIGGER FUNCTIONS

**Migration:** 021 (original), 022 (updated to correct schema)
Insert into `audit_logs` automatically on business creation, appointment creation, and payment confirmation.

---

## Triggers

| Trigger Name | Table | When | Function | Purpose |
|---|---|---|---|---|
| `on_auth_user_created` | `auth.users` | AFTER INSERT | `handle_new_user()` | Auto-creates `profiles` row on signup |
| `on_business_created_trial` | `businesses` | BEFORE INSERT | `handle_new_business_trial()` | Auto-starts 7-day Business plan trial |
| `trigger_log_new_business` | `businesses` | AFTER INSERT | `log_new_business()` | Writes audit log on business signup |
| `trigger_log_new_appointment` | `appointments` | AFTER INSERT | `log_new_appointment()` | Writes audit log on every new booking |
| `trigger_log_payment_update` | `payments` | AFTER UPDATE | `log_payment_update()` | Writes audit log when payment confirmed |

---

## Row Level Security Policies

### Summary Table

| Table | Policy | Operation | Condition |
|---|---|---|---|
| profiles | select_self_or_admin | SELECT | `id = auth.uid() OR is_admin()` |
| profiles | update_self_or_admin | UPDATE | `id = auth.uid() OR is_admin()` |
| profiles | insert_self | INSERT | `id = auth.uid() OR is_admin()` |
| businesses | public_read | SELECT | `true` (public) |
| businesses | owner_insert | INSERT | `owner_id = auth.uid() OR is_admin()` |
| businesses | owner_update | UPDATE | `owns_business()` |
| businesses | owner_delete | DELETE | `owns_business()` |
| service_categories | public_read_active | SELECT | `is_active = true OR owns_business()` |
| services | public_read_active | SELECT | `is_active = true OR owns_business()` |
| service_options | public_read_active | SELECT | `is_active = true OR owns_business()` |
| service_addons | public_read_active | SELECT | `is_active = true OR owns_business()` |
| availability | public_read | SELECT | `is_available = true OR owns_business()` |
| blocked_dates | public_read | SELECT | `true` |
| blocked_times | public_read | SELECT | business exists check |
| clients | owner_read | SELECT | `owns_business()` |
| clients | client_read_own | SELECT | `auth_user_id = auth.uid()` |
| appointments | owner_read | SELECT | `owns_business()` |
| appointments | client_read_own | SELECT | `client_auth_user_id = auth.uid()` |
| payments | owner_read + owner_update | SELECT/UPDATE | `owns_business()` |
| notifications | owner_read + owner_update | SELECT/UPDATE | `user_id = auth.uid() OR owns_business()` |
| audit_logs | Admins view | SELECT | `role = 'admin'` in profiles |
| audit_logs | Businesses view own | SELECT | `owns_business()` |
| audit_logs | Businesses insert | INSERT | `owns_business()` |
| admin_broadcasts | Admins manage | ALL | `role = 'admin'` |
| admin_broadcasts | Anyone can view active | SELECT | `is_active = true` |
| telegram_integrations | owner_all | ALL | `owns_business()` |
| chat_conversations | owner_select/update | SELECT/UPDATE | `owns_business()` |
| chat_conversations | service_role_all | ALL | `auth.role() = 'service_role'` |
| chat_messages | owner_select | SELECT | `owns_business()` |
| chat_messages | service_role_all | ALL | `auth.role() = 'service_role'` |
| chat_messages | owner_insert | INSERT | `owns_business()` |
| coupons | owner_all | ALL | `owns_business() OR is_admin()` |
| service_discounts | owner_all | ALL | `owns_business() OR is_admin()` |
| client_groups | owner_all | ALL | `owns_business() OR is_admin()` |

---

## Indexes

| Index | Table | Columns | Purpose |
|---|---|---|---|
| `businesses_owner_idx` | businesses | `(owner_id)` | Fast owner lookup in `getOwnedBusiness()` |
| `businesses_slug_idx` | businesses | `(slug)` | Booking page slug lookup (critical path) |
| `service_categories_business_idx` | service_categories | `(business_id, display_order)` | Ordered category list |
| `services_business_idx` | services | `(business_id, display_order)` | Ordered service list |
| `service_options_service_idx` | service_options | `(service_id, display_order)` | Option list per service |
| `service_addons_service_idx` | service_addons | `(service_id)` | Addon list per service |
| `appointments_business_date_idx` | appointments | `(business_id, appointment_date, start_time)` | Date-range queries in dashboard and slot checking |
| `appointments_coupon_idx` | appointments | `(coupon_id)` | Coupon redemption lookup |
| `appointments_client_auth_user_idx` | appointments | `(client_auth_user_id, appointment_date, start_time)` | Client portal — "my bookings" |
| `payments_business_idx` | payments | `(business_id, status)` | Payment dashboard filters |
| `payments_provider_checkout_session_id_idx` | payments | `(provider_checkout_session_id)` | Stripe webhook session lookup |
| `notifications_user_idx` | notifications | `(user_id, is_read, created_at DESC)` | Unread badge count and notification list |
| `blocked_times_business_date_idx` | blocked_times | `(business_id, date, start_time)` | Overlap check in create_public_booking |
| `coupons_business_code_idx` | coupons | `(business_id, code)` | Code validation lookup |
| `coupons_business_active_idx` | coupons | `(business_id, is_active)` | Active coupons filter |
| `coupon_redemptions_coupon_idx` | coupon_redemptions | `(coupon_id, created_at)` | Redemption count check |
| `coupon_redemptions_client_lookup_idx` | coupon_redemptions | `(business_id, lower(email), phone_normalized)` | Per-client redemption check |
| `service_discounts_business_service_idx` | service_discounts | `(business_id, service_id, service_option_id, is_active)` | Discount eligibility check |
| `service_discounts_active_window_idx` | service_discounts | `(business_id, is_active, starts_at, ends_at)` | Date-window filter |
| `client_groups_business_idx` | client_groups | `(business_id, name)` | Group list |
| `client_group_members_business_group_idx` | client_group_members | `(business_id, client_group_id)` | Members of a group |
| `clients_auth_user_idx` | clients | `(auth_user_id)` | Client account linkage |
| `clients_business_auth_user_idx` | clients | `(business_id, auth_user_id)` | Check existing client on login-booking |
| `chat_conversations_business_idx` | chat_conversations | `(business_id, platform, last_message_at DESC)` | Conversation list |
| `chat_conversations_external_idx` | chat_conversations | `(business_id, platform, external_chat_id)` | Webhook lookup |
| `chat_messages_conversation_idx` | chat_messages | `(conversation_id, created_at ASC)` | Message history |

---

## Storage Buckets

| Bucket | Public | File Size Limit | Allowed Types | Purpose |
|---|---|---|---|---|
| `business-logos` | true | 2 MB | png, jpeg, webp | Business logo uploads |
| `payment-receipts` | true | 5 MB | png, jpeg, webp | Client payment proof uploads |

**business-logos RLS:**
- Public SELECT by anyone
- INSERT/UPDATE restricted to authenticated owners whose `business.id` matches the storage folder name

**payment-receipts RLS:**
- Public SELECT by anyone
- INSERT by `anon` and `authenticated` (clients upload receipts without logging in)

---

## Migration History

| # | File | What It Does |
|---|---|---|
| 001 | `001_initial_booknest_schema.sql` | All base tables, functions, triggers, RLS, storage buckets |
| 002 | `002_repair_attach_public_receipt.sql` | Re-creates `attach_public_receipt()` for hosted deployments |
| 003 | `003_default_availability_fallback.sql` | Rewrites `create_public_booking()` with 09:00–18:00 fallback |
| 004 | `004_online_payment_provider_columns.sql` | Adds Stripe columns to payments |
| 005 | `005_business_booking_rules.sql` | Adds notice hours, max advance days, timezone, currency to businesses |
| 006 | `006_storage_public_policy_hardening.sql` | Tightens storage bucket policies |
| 007 | `007_business_cleanup_buffer.sql` | Adds `default_buffer_after_minutes` to businesses, rewrites RPC |
| 008 | `008_blocked_time_ranges.sql` | Adds `blocked_times` table, rewrites RPC to check it |
| 009 | `009_security_public_surface_hardening.sql` | Restricts public access to sensitive tables |
| 010 | `010_revoke_public_rpc_execute.sql` | Revokes dangerous public RPC grants |
| 011 | `011_free_price_type.sql` | Adds `'free'` to the price_type CHECK constraint |
| 012 | `012_coupon_discount_system.sql` | Adds `coupons` + `coupon_redemptions` tables |
| 013 | `013_client_accounts.sql` | Adds `auth_user_id`, `client_type`, `is_approved` to clients |
| 014 | `014_service_discounts.sql` | Adds `service_discounts` + `service_discount_redemptions` tables |
| 015 | `015_client_groups.sql` | Adds `client_groups` + `client_group_members` tables |
| 016 | `016_coupon_service_targeting.sql` | Adds `service_id`/`service_option_id` FK columns to coupons |
| 017 | `017_channels_integration.sql` | Adds Telegram + WhatsApp integration and chat tables |
| 018 | `018_platform_whatsapp.sql` | Adds `whatsapp_enabled` flag to businesses |
| 019 | `019_subscriptions.sql` | Adds subscription/plan columns + trial trigger to businesses |
| 020 | `020_admin_crm_fields.sql` | Adds `is_banned` + `ban_reason` to businesses |
| 021 | `021_admin_broadcasts_and_audit.sql` | Adds `admin_broadcasts` + rewrites `audit_logs` (new schema) |
| 022 | `022_unify_audit_logs_schema.sql` | Drops legacy `action`/`details`, enforces `event_type`/`message` NOT NULL, re-asserts RLS |

---

## Unused / Partially Used Tables

| Table | Status | Reason |
|---|---|---|
| `whatsapp_integrations` | **Partially used** | Created in 017 for per-business credentials, but 018 introduced a shared-platform `whatsapp_enabled` flag. No webhook handler currently reads per-business credentials for WhatsApp. |
| `client_groups` + `client_group_members` | **Schema exists, UI incomplete** | Tables are created and RLS is set. The `target_client_group_id` FK exists on coupons/discounts, but no dashboard UI for group management is confirmed to be built. |
| `subscription_id` / `stripe_customer_id` / `paystack_customer_code` on businesses | **Placeholder** | Schema columns exist. No subscription billing handler has been identified in the codebase. |
| `businesses.timezone` | **Stored but not enforced** | `timezone` column exists and is stored. The booking engine (`create_public_booking` RPC and `generateAvailableSlots()`) does not apply timezone conversion — all comparisons are naive local time. |
| `payments.confirmed_by` | **Rarely populated** | The confirm payment route does not appear to write `confirmed_by`. |
| `service_discount_redemptions.client_auth_user_id` | **Sparsely used** | Populated from optional auth context in the booking route. Walk-in bookings leave this null. |

---

## Identified Issues & Improvements

### 1. Dual WhatsApp Architecture (Conflict)
Migration 017 built per-business WhatsApp credential storage (`whatsapp_integrations`). Migration 018 then introduced a completely different model — a shared platform number with a simple toggle (`businesses.whatsapp_enabled`). These two approaches are in direct conflict. **Recommendation:** Decide on one model and drop the other table or clearly separate their use cases.

### 2. Timezone Not Applied in Booking Engine
`businesses.timezone` is stored but never applied in the PostgreSQL RPC or the TypeScript slot generator. A business in London using timezone `'Europe/London'` and a client in Lagos will both see slot times in the server's local time. **Recommendation:** Convert `p_appointment_date + p_start_time` to the business timezone before all comparisons in `create_public_booking()`.

### 3. `appointments.client_name` Denormalization Drift
`client_name` is denormalized directly on `appointments`. If the owner updates the name on the `clients` table, the appointment history still shows the old name. This is intentional for historical accuracy but is not documented. **Recommendation:** Add a migration comment confirming this is deliberate.

### 4. `create_public_booking()` Rewritten 4 Times
Migrations 001, 003, 007, and 008 each replace the full RPC body. This creates a fragile pattern — any future migration must copy the entire function body. **Recommendation:** Break the function into smaller composable helper functions to reduce the copy-paste surface.

### 5. No Unique Constraint on `availability(business_id, day_of_week)`
A business can have multiple conflicting rows for the same `day_of_week`. The RPC uses `EXISTS` which would find one of them, but which one is indeterminate. **Recommendation:** `ALTER TABLE availability ADD CONSTRAINT availability_business_day_unique UNIQUE (business_id, day_of_week);`

### 6. Missing Index on `audit_logs(business_id, created_at)`
The activity page queries audit logs filtered by `business_id` and ordered by `created_at DESC`. There is no index supporting this query. **Recommendation:** `CREATE INDEX audit_logs_business_created_idx ON audit_logs(business_id, created_at DESC);`

### 7. `payments` Has No INSERT RLS Policy
The payments table has `SELECT` and `UPDATE` policies for owners, but no explicit `INSERT` policy. New payment rows are created exclusively via `SECURITY DEFINER` RPC functions (`create_public_booking`, `attach_public_receipt`) or the admin client in API routes — so this works in practice but is worth documenting.

### 8. `notifications` Has No DELETE Policy
Once read, notifications cannot be deleted by the owner. There is no cleanup mechanism. Over time this table will grow unbounded. **Recommendation:** Add a TTL-based cleanup job or a DELETE policy.

### 9. `audit_logs.user_id` Is Always NULL for Trigger-Generated Rows
All three trigger functions (`log_new_business`, `log_new_appointment`, `log_payment_update`) insert without `user_id`. This means trigger-generated audit rows have no actor. **Recommendation:** Use `auth.uid()` where available, or document the null as "system-generated".
