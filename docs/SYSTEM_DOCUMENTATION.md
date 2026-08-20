# BookNest — Comprehensive System Architecture, Security & Onboarding Reference

> Lead Software Architect & Solution Architecture Audit
> Generated from total repository reverse engineering and static analysis.

---

## Executive Summary & Artifact Directory

This document serves as the authoritative technical reference for the BookNest platform. It synthesizes all reverse-engineered findings across business logic, state management, security architecture, and system engineering.

| Document | Purpose |
|---|---|
| 📄 [SYSTEM_DOCUMENTATION.md](./SYSTEM_DOCUMENTATION.md) | Complete architecture, state flow, security audit & onboarding manual (This document) |
| 📄 [DATABASE_REFERENCE.md](./DATABASE_REFERENCE.md) | Database schema, RLS policies, functions, triggers, and index strategy |
| 📄 [CODEBASE_ANALYSIS.md](./CODEBASE_ANALYSIS.md) | Dependency tree, module classification, and code metrics |
| 📄 [EXECUTION_FLOWS.md](./EXECUTION_FLOWS.md) | Sequence diagrams and request-response traces for 9 core business flows |
| 📄 [SUBSYSTEM_MAP.md](./SUBSYSTEM_MAP.md) | Subsystem boundaries and inter-service communication contracts |
| 📄 [ARCHITECTURE.md](./ARCHITECTURE.md) | Technology stack and high-level architectural philosophy |

---

## Part 1: Complete Business Feature & Logic Map

### 1. Booking Engine

*   **Purpose**: Allows anonymous or authenticated clients to select services, options, add-ons, dates, and times to book an appointment with a business.
*   **Workflow**:
    1. Client visits public route `/book/[businessSlug]` or embedded iframe `/embed/[businessSlug]`.
    2. Client selects a service, optional service option, and add-ons.
    3. Client picks an available date. The UI calls `/api/slots` to query open slots.
    4. Client enters personal details (name, email, phone, custom form answers) and applies an optional coupon code.
    5. Client submits booking. Request is posted to `POST /api/appointments`.
    6. Server validates input with Zod, checks rate limits, calculates service discounts (`lib/service-discounts.ts`) and coupons (`lib/coupons.ts`), then invokes the `create_public_booking(...)` PostgreSQL RPC.
    7. Database acquires an advisory lock (`pg_advisory_xact_lock`), validates availability/block rules, inserts records into `clients`, `appointments`, `appointment_addons`, `payments` (if deposit required), `form_answers`, and `notifications`.
*   **Files Involved**:
    *   `src/app/book/[businessSlug]/page.tsx`
    *   `src/app/embed/[businessSlug]/page.tsx`
    *   `src/components/booking/BookingFlow.tsx`
    *   `src/app/api/appointments/route.ts`
    *   `src/app/api/slots/route.ts`
    *   `src/lib/booking/availability.ts`
    *   `src/lib/coupons.ts`
    *   `src/lib/service-discounts.ts`
    *   `src/lib/validators.ts`
*   **Database Tables**: `businesses`, `services`, `service_options`, `service_addons`, `availability`, `blocked_dates`, `blocked_times`, `clients`, `appointments`, `appointment_addons`, `payments`, `form_questions`, `form_answers`, `notifications`, `audit_logs`.
*   **API Routes**: `POST /api/appointments`, `GET /api/slots`, `POST /api/coupons/validate`, `POST /api/discounts/preview`.
*   **Permissions**: Public / Anonymous access allowed (`anon` role granted RPC execute permissions).

---

### 2. Availability & Scheduling System

*   **Purpose**: Manages business working hours, whole-day blocks, time-range blocks, and per-service buffer times to compute valid booking slots.
*   **Workflow**:
    1. Owner configures recurring weekly availability (`availability` table) and buffer preferences via dashboard.
    2. Owner can block specific dates (`blocked_dates`) or specific time ranges (`blocked_times`).
    3. When slots are requested (`GET /api/slots`), the system fetches booked ranges from database via `get_booked_appointment_ranges` RPC.
    4. `generateAvailableSlots()` in `src/lib/booking/availability.ts` generates candidate slots step-by-step (default 30-min intervals) and filters out:
        *   Times outside weekly availability windows.
        *   Times on blocked dates or inside blocked time ranges.
        *   Times overlapping existing appointments plus setup/cleanup buffers (`buffer_before_minutes`, `buffer_after_minutes`, `default_buffer_after_minutes`).
        *   Times violating notice hours (`booking_notice_hours`) or max advance booking days (`max_advance_booking_days`).
*   **Files Involved**:
    *   `src/components/dashboard/AvailabilityPanel.tsx`
    *   `src/app/api/availability/route.ts`
    *   `src/app/api/availability/[value]/route.ts`
    *   `src/app/api/blocked-dates/route.ts`
    *   `src/app/api/blocked-dates/[id]/route.ts`
    *   `src/app/api/blocked-times/route.ts`
    *   `src/app/api/blocked-times/[id]/route.ts`
    *   `src/lib/booking/availability.ts`
*   **Database Tables**: `availability`, `blocked_dates`, `blocked_times`, `appointments`, `services`, `businesses`.
*   **Permissions**: Owner/Admin write access (`owns_business(business_id)` RLS policy). Public read access for slot computation.

---

### 3. Client & CRM Management

*   **Purpose**: Tracks customer interaction history, client types (regular, model, VIP), client accounts, and custom client groups.
*   **Workflow**:
    1. Whenever a booking occurs, the `create_public_booking` RPC checks for an existing client by email or phone. If found, it updates the record; if not, it inserts a new `clients` row.
    2. Logged-in users are linked via `auth_user_id` when booking or claiming accounts.
    3. Business owners view client lists, update client classifications (`client_type`), approve model accounts (`is_approved`), and create custom `client_groups` in the CRM dashboard.
    4. Client types and group memberships drive targeted coupon and discount eligibility.
*   **Files Involved**:
    *   `src/components/dashboard/ClientsPanel.tsx`
    *   `src/app/api/dashboard/clients/route.ts`
    *   `src/app/api/dashboard/clients/[id]/route.ts`
    *   `src/app/api/dashboard/client-groups/route.ts`
    *   `src/app/api/dashboard/client-groups/[id]/route.ts`
*   **Database Tables**: `clients`, `client_groups`, `client_group_members`, `appointments`, `auth.users`.
*   **Permissions**: Business owner access enforced via `owns_business(business_id)`. Logged-in clients can view their own record via `client_read_own` policy.

---

### 4. Payments & Financial Processing

*   **Purpose**: Facilitates deposit payments, full online payments (Stripe Checkout), and manual bank transfer receipt uploads.
*   **Workflow**:
    *   **Stripe Flow**:
        1. Client selects online payment. Request sent to `POST /api/payments/stripe-checkout`.
        2. Server creates a Stripe Checkout session with metadata (`appointment_id`, `business_id`) and returns the checkout URL.
        3. Webhook at `POST /api/payments/stripe-webhook` receives `checkout.session.completed` event, validates Stripe signature, marks `payments.status = 'confirmed'`, updates `appointments.payment_status = 'confirmed'`, and inserts a notification.
    *   **Manual Receipt Flow**:
        1. Client uploads payment receipt image to Supabase Storage (`payment-receipts` bucket).
        2. Client submits receipt via `POST /api/payments/upload-receipt`, which calls `attach_public_receipt` RPC.
        3. Payment status is set to `'receipt_uploaded'`; appointment status transitions to `'pending_confirmation'`.
        4. Owner reviews receipt image in dashboard and clicks Confirm (`POST /api/payments/[id]/confirm`) or Reject (`POST /api/payments/[id]/reject`).
*   **Files Involved**:
    *   `src/components/dashboard/PaymentsPanel.tsx`
    *   `src/services/payments/stripeCheckoutProvider.ts`
    *   `src/app/api/payments/stripe-checkout/route.ts`
    *   `src/app/api/payments/stripe-webhook/route.ts`
    *   `src/app/api/payments/upload-receipt/route.ts`
    *   `src/app/api/payments/[id]/confirm/route.ts`
    *   `src/app/api/payments/[id]/reject/route.ts`
*   **Database Tables**: `payments`, `appointments`, `businesses`, `notifications`, `audit_logs`.
*   **Permissions**: Webhook uses `service_role` (bypasses RLS). Confirm/Reject routes require `requireOwnedBusiness()`.

---

### 5. Telegram Conversational Booking Integration

*   **Purpose**: Enables clients to book, view, reschedule, or cancel appointments via a native Telegram Bot powered by an in-memory/database state machine.
*   **Workflow**:
    1. Client sends a message to the business's Telegram Bot.
    2. Telegram sends a POST webhook payload to `POST /api/webhooks/telegram`.
    3. Handler validates header/secret, decrypts bot credentials, and retrieves or initializes a `chat_conversations` record.
    4. `processMessage()` in `src/services/notifications/bookingAutomation.ts` executes the state machine step:
        *   `idle` → `awaiting_service` → `awaiting_date` → `awaiting_time` → `awaiting_name` → `awaiting_email` → `awaiting_confirmation`.
    5. On final confirmation, `processMessage()` calls `create_public_booking` RPC directly.
    6. Bot sends confirmation message back to client via Telegram Bot API (`src/services/notifications/telegramService.ts`).
*   **Files Involved**:
    *   `src/app/api/webhooks/telegram/route.ts`
    *   `src/services/notifications/bookingAutomation.ts`
    *   `src/services/notifications/telegramService.ts`
    *   `src/lib/encryption.ts`
    *   `src/components/dashboard/IntegrationsPanel.tsx`
*   **Database Tables**: `telegram_integrations`, `chat_conversations`, `chat_messages`, `appointments`, `services`, `clients`.
*   **Permissions**: Webhook operates under `service_role` key to update conversations and create bookings. Credentials encrypted with AES-256-CBC.

---

### 6. Admin Control & Platform Governance

*   **Purpose**: Provides super-admins with capabilities to view system-wide stats, manage businesses, ban accounts, broadcast platform announcements ("Megaphone"), inspect AI logs, and impersonate business owners.
*   **Workflow**:
    1. Admin logs in. `admin/layout.tsx` checks `profiles.role === 'admin'`. If false, redirects to dashboard.
    2. Admin can toggle business bans (`POST /api/admin/businesses/[id]`). Banned businesses cannot process bookings.
    3. Admin manages global announcements via `admin_broadcasts` table (`POST /api/admin/broadcasts`). Announcements display as banners on owner dashboards.
    4. Admin can impersonate a business owner (`POST /api/admin/impersonate`), generating an auth session link.
*   **Files Involved**:
    *   `src/app/admin/layout.tsx`
    *   `src/app/admin/page.tsx`
    *   `src/app/admin/businesses/page.tsx`
    *   `src/app/admin/businesses/[id]/page.tsx`
    *   `src/app/admin/broadcasts/page.tsx`
    *   `src/app/admin/activity/page.tsx`
    *   `src/app/admin/ai-logs/page.tsx`
    *   `src/app/admin/exports/page.tsx`
    *   `src/components/admin/*.tsx`
    *   `src/app/api/admin/*`
*   **Database Tables**: `profiles`, `businesses`, `admin_broadcasts`, `audit_logs`, `appointments`.
*   **Permissions**: Strictly restricted to `profiles.role = 'admin'` via RLS policies and server-side layout guards.

---

## Part 2: Application State Flow & Race Condition Analysis

### 1. State Map & Lifecycles

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           APPLICATION STATE MAP                             │
├──────────────────┬──────────────────────┬───────────────────────────────────┤
│ State Scope      │ Storage / Mechanism  │ Lifecycle & Mutators              │
├──────────────────┼──────────────────────┼───────────────────────────────────┤
│ Auth State       │ Supabase Auth (JWT + │ Persisted in browser cookies/LS.  │
│                  │ cookies)             │ Mutated by AuthCard, logout.      │
├──────────────────┼──────────────────────┼───────────────────────────────────┤
│ Booking UI State │ React local state    │ Transient in BookingFlow.tsx.     │
│                  │ (useState)           │ Reset on page refresh.            │
├──────────────────┼──────────────────────┼───────────────────────────────────┤
│ Chat FSM State   │ PostgreSQL JSONB     │ Persisted in chat_conversations.  │
│                  │ (state column)       │ Mutated by bookingAutomation.ts.  │
├──────────────────┼──────────────────────┼───────────────────────────────────┤
│ Server State     │ Next.js App Router   │ Request-scoped. Fetched via       │
│                  │ Server Components    │ Supabase server client on load.   │
├──────────────────┼──────────────────────┼───────────────────────────────────┤
│ Rate Limit State │ Node.js globalThis   │ In-memory Map. Cleared on server  │
│                  │ (__booknestRateLimit)│ restart / cold start.             │
└──────────────────┴──────────────────────┴───────────────────────────────────┤
```

---

### 2. Concurrency & Race Condition Analysis

#### A. Double Booking Concurrency (Resolved in Database)
*   **Scenario**: Two clients attempt to book the exact same slot (`2026-08-01 10:00`) simultaneously.
*   **Mechanism**: The Node.js API layer is stateless and allows concurrent incoming requests. However, inside PostgreSQL, `create_public_booking` executes:
    ```sql
    PERFORM pg_advisory_xact_lock(hashtext(v_business.id::text || ':' || p_appointment_date::text));
    ```
*   **Outcome**: The first transaction acquires an exclusive transaction-level lock for that business + date. The second transaction blocks until the first completes. Once unblocked, the second transaction re-evaluates the overlap query, detects the newly inserted appointment, and raises an exception: `'Selected time is no longer available'`.
*   **Verdict**: **Race condition prevented at DB tier.**

#### B. In-Memory Rate Limiting Cold-Start Leak (Vulnerability)
*   **Scenario**: A malicious actor spams `POST /api/appointments` across multiple serverless instances (Vercel Functions).
*   **Mechanism**: `src/lib/rate-limit.ts` uses `globalThis.__booknestRateLimit = new Map()`.
*   **Outcome**: In a serverless environment with multiple concurrent lambdas, each container maintains its own isolated Map. An attacker can bypass the 8 req/min limit by hitting different lambda instances.
*   **Verdict**: **High-risk state leak.** Needs Redis or Supabase-backed rate limiting.

#### C. Telegram Webhook Out-of-Order Message Processing (Vulnerability)
*   **Scenario**: A Telegram user rapidly sends two messages: `"Haircut"` followed immediately by `"Tomorrow"`.
*   **Mechanism**: Telegram fires two HTTP POST requests to `/api/webhooks/telegram` in parallel.
*   **Outcome**: Request 1 reads `state = {"step":"awaiting_service"}`. Request 2 reads the same `state` before Request 1 writes `{"step":"awaiting_date"}`. Request 2 fails or corrupts the FSM step.
*   **Verdict**: **State machine race condition.** Needs row-level locking (`SELECT ... FOR UPDATE`) when fetching `chat_conversations`.

---

## Part 3: Security Architecture Review

### 1. Vulnerability & Risk Matrix

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        SECURITY VULNERABILITY MATRIX                        │
├──────────┬────────────────────────────┬──────────┬──────────────────────────┤
│ ID       │ Finding                    │ Severity │ Impact                   │
├──────────┼────────────────────────────┼──────────┼──────────────────────────┤
│ SEC-001  │ Hardcoded Encryption Key   │ CRITICAL │ Key fallback in          │
│          │ Dev Fallback               │          │ encryption.ts exposes    │
│          │                            │          │ Telegram/WA tokens.      │
├──────────┼────────────────────────────┼──────────┼──────────────────────────┤
│ SEC-002  │ In-Memory Rate Limiter on  │ HIGH     │ Rate limit bypass in     │
│          │ Serverless Infrastructure │          │ distributed environment. │
├──────────┼────────────────────────────┼──────────┼──────────────────────────┤
│ SEC-003  │ Missing RLS INSERT Policy  │ MEDIUM   │ Direct table inserts bypass│
│          │ on `payments` Table        │          │ client validation.       │
├──────────┼────────────────────────────┼──────────┼──────────────────────────┤
│ SEC-004  │ Un-authenticated Public    │ MEDIUM   │ Unlimited receipt image  │
│          │ Storage Uploads            │          │ uploads to storage.      │
├──────────┼────────────────────────────┼──────────┼──────────────────────────┤
│ SEC-005  │ `timezone` Ignored in      │ LOW      │ Incorrect booking times  │
│          │ Slot Computation           │          │ across timezones.        │
└──────────┴────────────────────────────┴──────────┴──────────────────────────┘
```

---

### 2. Detailed Security Findings

#### 🔴 CRITICAL: Hardcoded AES Encryption Fallback Key (`src/lib/encryption.ts`)
*   **Location**: `src/lib/encryption.ts`, lines 8–10:
    ```typescript
    if (!key) {
      return Buffer.from("booknest_dev_key_32chars_padding!", "utf8").subarray(0, 32);
    }
    ```
*   **Exploit Vector**: If `ENCRYPTION_KEY` is omitted from production environment variables, the system silently defaults to this known string. An attacker with SELECT access to `telegram_integrations` or `whatsapp_integrations` can decrypt all stored Telegram bot tokens and WhatsApp access tokens.
*   **Remediation**: Remove the fallback entirely. Throw a hard fatal error on app startup if `ENCRYPTION_KEY` is missing or less than 32 characters.

#### 🟠 HIGH: Serverless In-Memory Rate Limiting (`src/lib/rate-limit.ts`)
*   **Location**: `src/lib/rate-limit.ts`
*   **Exploit Vector**: Rate limits rely on `globalThis`. On Vercel, requests are distributed across dozens of ephemeral lambdas. Rate limiting is ineffective against distributed attacks or automated carding attempts on Stripe checkout routes.
*   **Remediation**: Migrate `rate-limit.ts` to Upstash Redis (`@upstash/ratelimit`) or Supabase RPC-based token bucket.

#### 🟡 MEDIUM: Missing `payments` Table INSERT RLS Policy
*   **Location**: `supabase/migrations/001_initial_booknest_schema.sql`
*   **Exploit Vector**: `payments` table enables RLS and defines SELECT/UPDATE policies for owners, but omits an explicit INSERT policy. While RPCs run as `SECURITY DEFINER`, any direct authenticated Supabase client query trying to insert into `payments` will be rejected by default (which is safe), but explicit policies prevent ambiguity.
*   **Remediation**: Add explicit `CREATE POLICY "Deny direct public insert" ON public.payments FOR INSERT WITH CHECK (false);`

---

## Part 4: Reverse Engineering & Onboarding Manual (28 Subsystems)

### 1. Folder Structure & Organization
*   **Architecture**: Next.js 16 App Router using standard `/src` layout.
*   **Directories**:
    *   `/src/app`: Page routes, layouts, and REST API handlers.
    *   `/src/components`: UI components organized by domain (`admin`, `auth`, `booking`, `dashboard`).
    *   `/src/lib`: Shared infrastructure, database clients, validators, formatting, and mathematical utilities.
    *   `/src/services`: Domain service integration modules (payments, notifications).
    *   `/supabase/migrations`: 22 SQL migration scripts forming the database foundation.

### 2. High-Level Architecture
*   **Pattern**: Monolithic Next.js application with a Serverless API layer and a Heavy-Database Backend (PostgreSQL RPCs + Triggers).
*   **Data Flow**: Client → Next.js API Route (Zod validation + Rate Limit) → PostgreSQL RPC (Advisory Lock + Atomic Transaction) → PostgreSQL Triggers (Audit Log + Notifications) → Client Response.

### 3. Execution Flow Overview
*   All public interactions pass through Server Components for initial HTML render and hydrate Client Components (`BookingFlow.tsx`) for dynamic state.
*   API requests use standard JSON responses generated by helper functions in `src/lib/api.ts` (`ok()`, `fail()`, `safeError()`).

### 4. Database Schema & Relational Design
*   25 tables in `public` schema. Foreign keys cascade appropriately (`ON DELETE CASCADE` for child catalog/appointment items; `ON DELETE SET NULL` for non-critical relationships like client groups or coupons).

### 5. API Route Conventions
*   Routes use Next.js `export async function POST/GET/DELETE(request: Request)`.
*   Standardized authorization checks: `requireUser()` verifies auth token; `requireOwnedBusiness()` verifies business ownership.

### 6. Component Architecture
*   Components are categorized into:
    *   **Page Containers**: Handle page layout and breadcrumbs.
    *   **Panel Components**: Heavy client components (`AppointmentsPanel`, `CatalogManager`) managing local CRUD states.
    *   **Primitives**: Unified loader (`BookNestLoader.tsx`) and error fallback (`FriendlyError.tsx`).

### 7. Services Layer
*   Services encapsulate third-party API communications:
    *   `telegramService.ts`: Direct fetch calls to Telegram Bot API.
    *   `whatsappService.ts`: Meta Graph API integration.
    *   `stripeCheckoutProvider.ts`: Stripe SDK wrapper for session creation.

### 8. Utilities Layer
*   `lib/validators.ts`: 18+ Zod validation schemas enforcing input bounds.
*   `lib/format.ts`: Pure functions for date formatting, currency display, and URL slugification.
*   `lib/encryption.ts`: AES-256-CBC string encryption helper.

### 9. Booking Engine Technical Design
*   Combines TypeScript pre-computation (`lib/booking/availability.ts`) for fast UI rendering with PL/pgSQL atomic enforcement (`create_public_booking`) for strict database integrity.

### 10. Scheduling Engine Technical Design
*   Supports multi-layered slot exclusion: Weekly availability → Whole-day blocks → Specific time-range blocks → Existing appointment overlaps → Setup/cleanup buffers.

### 11. Dashboard Subsystem
*   Owner workspace. Renders 18 distinct panels. All layout routes verify owner profile via `createSupabaseServerClient()`.

### 12. Admin Panel Subsystem
*   Platform governance interface. Guarded by `profiles.role === 'admin'`. Operates with `createSupabaseAdminClient()` for cross-tenant visibility.

### 13. Telegram Integration Subsystem
*   Stateless webhook endpoint feeding a stateful database FSM (`chat_conversations.state`). Handles full multi-step booking dialogs via text.

### 14. Authentication Subsystem
*   Built on Supabase Auth. Triggers automatically create application profiles (`profiles` table) on `auth.users` insert.

### 15. Supabase Integration
*   Utilizes three distinct client instances:
    *   `browser.ts`: Anonymous/Authenticated browser client.
    *   `server.ts`: Server-side client reading user cookies.
    *   `admin.ts`: Service-role client bypassing RLS for internal tasks.

### 16. SQL Migrations
*   22 sequential files managing schema evolution from initial MVP setup to unified audit logging (`022_unify_audit_logs_schema.sql`).

### 17. RPC Functions
*   Centralizes complex multi-table transactional business logic in SQL to eliminate network round-trips and guarantee atomic safety.

### 18. Database Triggers
*   Automates non-blocking cross-cutting concerns (Audit logging on business creation, appointment booking, payment confirmation; Trial period initialization).

### 19. Row Level Security (RLS)
*   Enforces multi-tenant data isolation at the database layer using `owns_business(business_id)` helper function.

### 20. State Management Strategy
*   React local state for UI transitions; Supabase Server Components for page state; PostgreSQL tables/JSONB for persistent state.

### 21. Error Handling Architecture
*   API errors are wrapped in `fail(message, status)` to prevent leaking stack traces or internal DB details to clients.

### 22. Security Controls
*   Input sanitization via Zod, parameterization via Supabase/PostgreSQL query builders, AES encryption for secrets at rest.

### 23. Deployment & Infrastructure
*   Optimized for Vercel deployment with Supabase PostgreSQL backend.

### 24. Environment Variables
*   Centralized validation in `src/lib/env.ts`.

### 25. External Services
*   Stripe (Payments), Meta Graph API (WhatsApp), Telegram Bot API, Supabase Storage (Logos & Receipts).

### 26. Performance Profile
*   Database advisory locks prevent lock contention across different dates or businesses. Indexed lookups on critical paths (`slug`, `business_id`, `appointment_date`).

### 27. Technical Debt Summary
*   No automated unit or integration tests.
*   In-memory rate limiter on serverless.
*   Large monolithic components (`BookingFlow.tsx`, `IntegrationsPanel.tsx`).
*   Orphaned service file (`inAppNotificationService.ts`).

### 28. Future Scaling Recommendations
*   Implement Upstash Redis for distributed rate limiting.
*   Add Playwright/Jest test suite for booking RPC and slot calculations.
*   Extract FSM handlers into dedicated modular step handlers.
