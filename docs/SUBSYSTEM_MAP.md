# BookNest — Comprehensive Subsystem Architecture Specification

---

## Executive Overview

BookNest is organized into 16 distinct, loosely-coupled subsystems. This document provides complete architectural specifications for each subsystem, detailing its purpose, entry point, dependencies, internal data flow, file index, and inter-subsystem communications.

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                               FRONTEND SUBSYSTEM                                 │
│    (Pages: Dashboard, Booking Flow, Client Portal, Super Admin Console)          │
└─────────┬──────────────────────────────────────────────────────────────┬─────────┘
          │                                                              │
          ▼                                                              ▼
┌───────────────────────────┐                              ┌───────────────────────────┐
│     COMPONENTS SUBSYSTEM  │                              │    API ROUTES SUBSYSTEM   │
│  (Panels, Nav, Wizards)   │                              │ (REST API & Webhooks)     │
└─────────┬─────────────────┘                              └─────────────┬─────────────┘
          │                                                              │
          └───────────────────────────────┬──────────────────────────────┘
                                          │
                                          ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                               BACKEND SUBSYSTEM                                  │
│                 (Authentication, API Helpers, Rate Limiter)                      │
└──────┬──────────────┬──────────────────┬──────────────────┬───────────────┬──────┘
       │              │                  │                  │               │
       ▼              ▼                  ▼                  ▼               ▼
┌─────────────┐┌─────────────┐    ┌─────────────┐    ┌─────────────┐ ┌─────────────┐
│  DATABASE   ││   BOOKING   │    │  PAYMENTS   │    │TELEGRAM/WA  │ │NOTIFICATIONS│
│  SUBSYSTEM  ││   ENGINE    │    │  SUBSYSTEM  │    │ INTEGRATION │ │  SUBSYSTEM  │
└─────────────┘└─────────────┘    └─────────────┘    └─────────────┘ └─────────────┘
```

---

## Subsystem Architectural Specifications

### 1. Frontend Subsystem
* **Purpose**: Serves as the user interface layer for three distinct user personas: Business Owners (Dashboard), End Clients (Booking Flow & Client Portal), and Super-Admins (Platform Console).
* **Entry Point**: `src/app/layout.tsx` (Global HTML Layout) and `src/app/page.tsx` (Landing Page).
* **Dependencies**: Next.js 16 (App Router), React 19, Tailwind CSS, Lucide React icons.
* **Data Flow**: User action in browser → React State / Form input → Client Component → Next.js App Router navigation or `fetch()` call to API Routes → State re-render.
* **Files Involved**:
  * `src/app/layout.tsx`
  * `src/app/page.tsx`
  * `src/app/globals.css`
  * `src/app/error.tsx` & `src/app/global-error.tsx`
  * `src/app/loading.tsx` & `src/app/not-found.tsx`
* **Inter-subsystem Communication**: Passes user events to the **Components Subsystem**, requests data from **API Routes**, and consumes authentication state from the **Authentication Subsystem**.

---

### 2. Backend Subsystem
* **Purpose**: Executes server-side business logic, request validation, rate limiting, and database query wrapping.
* **Entry Point**: REST Endpoint Route Handlers (`src/app/api/**/route.ts`).
* **Dependencies**: `src/lib/api.ts`, `@supabase/ssr`, `@supabase/supabase-js`, `zod`.
* **Data Flow**: HTTP Request → `getRequestKey()` (Rate Limiter check) → `requireUser()` / `requireOwnedBusiness()` → Zod schema parsing → Supabase DB/RPC query → Standardized `ok()` or `fail()` JSON response.
* **Files Involved**:
  * `src/lib/api.ts`
  * `src/lib/rate-limit.ts`
  * `src/lib/validators.ts`
  * `src/lib/env.ts`
* **Inter-subsystem Communication**: Receives HTTP calls from **Frontend Subsystem**, invokes algorithms in **Booking Engine**, queries **Database Subsystem**, and dispatches to **Services Subsystem**.

---

### 3. API Routes Subsystem
* **Purpose**: Provides a structured RESTful API endpoint hierarchy handling all CRUD operations, automated jobs, and external webhooks.
* **Entry Point**: `src/app/api/` directory.
* **Dependencies**: Next.js `NextRequest` and `NextResponse`, Supabase Server and Admin clients.
* **Data Flow**: HTTP Client / External Webhook → Next.js Router → Dynamic Route Match (`/api/payments/[id]/reject`) → Handler execution → JSON Response.
* **Files Involved** (21 route categories):
  * `src/app/api/appointments/**`
  * `src/app/api/availability/**`
  * `src/app/api/business/**`
  * `src/app/api/client/**`
  * `src/app/api/payments/**`
  * `src/app/api/slots/**`
  * `src/app/api/webhooks/**`
* **Inter-subsystem Communication**: Bridges external callers (Stripe, Telegram, Meta) and internal **Frontend Subsystem** components to the **Backend Subsystem** logic.

---

### 4. Database Subsystem
* **Purpose**: Guarantees multi-tenant data persistence, Row Level Security (RLS) isolation, concurrency protection via transaction advisory locks, and automated audit logging.
* **Entry Point**: Supabase PostgreSQL Cloud instance; schemas managed via `supabase/migrations/*.sql`.
* **Dependencies**: Supabase PostgreSQL 15+, PL/pgSQL functions.
* **Data Flow**: Application query (via `server.ts` or `admin.ts`) → PostgreSQL RLS Policy check → PL/pgSQL Function execution → Trigger execution (`trigger_log_new_appointment`) → `public.audit_logs` insert → Table data return.
* **Files Involved**:
  * `supabase/migrations/001_initial_booknest_schema.sql` through `022_unify_audit_logs_schema.sql`
  * `supabase/seed.sql`
  * `src/lib/supabase/server.ts`, `browser.ts`, `admin.ts`
* **Inter-subsystem Communication**: Serves as the central data store for all subsystems (**Booking Engine**, **Clients**, **Payments**, **Admin**, **Notifications**).

---

### 5. Authentication Subsystem
* **Purpose**: Manages owner/client identities, encrypted cookie sessions, multi-tenant role enforcement, and super-admin session impersonation.
* **Entry Point**: `/login`, `/signup`, `/client/login`, and `/impersonate`.
* **Dependencies**: Supabase Auth (`@supabase/ssr`), `auth.users`, `public.profiles`.
* **Data Flow**: User submits credentials → `supabase.auth.signInWithPassword()` → Encrypted session token stored in HTTPS-only cookies → Middleware checks `auth.uid()` against `owns_business(business_id)`.
* **Files Involved**:
  * `src/app/login/page.tsx` & `src/app/signup/page.tsx`
  * `src/app/impersonate/page.tsx`
  * `src/app/api/admin/impersonate/route.ts`
  * `src/components/auth/AuthCard.tsx`
* **Inter-subsystem Communication**: Provides security context (`user_id`, `role`) to **Backend Subsystem**, **Dashboard Subsystem**, and **Database RLS Policies**.

---

### 6. Booking Engine Subsystem
* **Purpose**: Core domain engine responsible for slot availability calculation, duration arithmetic, notice hour checks, double-booking prevention, and public booking transaction execution.
* **Entry Point**: `src/lib/booking/availability.ts` & `/book/[businessSlug]`.
* **Dependencies**: `public.availability`, `public.blocked_dates`, `public.blocked_times`, `public.appointments`, RPC `create_public_booking`.
* **Data Flow**: Date/Service selected → `generateAvailableSlots()` computes valid times → Client confirms → RPC `create_public_booking` executes `pg_advisory_xact_lock` → Validates availability → Upserts `clients` record → Inserts `appointments` → Fires audit log trigger.
* **Files Involved**:
  * `src/lib/booking/availability.ts`
  * `src/app/book/[businessSlug]/page.tsx`
  * `src/components/booking/BookingFlow.tsx`
  * `src/app/api/slots/route.ts`
  * `supabase/migrations/008_blocked_time_ranges.sql`
* **Inter-subsystem Communication**: Consumes rules from **Scheduling Subsystem**, outputs bookings to **Payments Subsystem**, **Clients Subsystem**, and **Notifications Subsystem**.

---

### 7. Notifications Subsystem
* **Purpose**: Handles in-app dashboard alerts, manual WhatsApp/Email template generation, browser notifications, and push message delivery.
* **Entry Point**: `src/services/notifications/inAppNotificationService.ts`.
* **Dependencies**: PostgreSQL `notifications` table, Lucide notification badges.
* **Data Flow**: Business event occurs → `createInAppNotification()` inserts row → Owner Dashboard polls `/api/notifications` → Banners and badge count update.
* **Files Involved**:
  * `src/services/notifications/inAppNotificationService.ts`
  * `src/services/notifications/manualWhatsAppService.ts`
  * `src/services/notifications/manualEmailTemplateService.ts`
  * `src/services/notifications/browserNotificationHelper.ts`
  * `src/app/api/notifications/[id]/read/route.ts`
* **Inter-subsystem Communication**: Listens to **Booking Engine** and **Payments Subsystem** events; outputs messages to **Dashboard Subsystem**.

---

### 8. Dashboard Subsystem
* **Purpose**: Operational management suite for business owners to manage catalogs, check calendar schedules, confirm payments, view client CRM, and copy website embed code.
* **Entry Point**: `src/app/dashboard/page.tsx` & `src/app/dashboard/layout.tsx`.
* **Dependencies**: Next.js Server Components, `getOwnedBusiness()`, Dashboard UI Panels.
* **Data Flow**: Owner logs in → `layout.tsx` checks auth → `getOwnedBusiness()` fetches business data → Displays navigation sidebar → Panel loads data via server fetch / client API calls.
* **Files Involved**:
  * `src/app/dashboard/layout.tsx`
  * `src/app/dashboard/**/*` (19 subpages)
  * `src/components/dashboard/*` (10 panels)
* **Inter-subsystem Communication**: Interfaces directly with **Scheduling**, **Services**, **Clients**, **Payments**, and **Telegram Subsystems**.

---

### 9. Admin Subsystem
* **Purpose**: Super-admin platform management suite providing platform analytics, business directory CRM, global broadcast banners (Megaphone), live AI conversation inspection (The Watcher AI Logs), real-time audit feed (Activity Log), and tenant session impersonation.
* **Entry Point**: `src/app/admin/page.tsx`.
* **Dependencies**: `createSupabaseAdminClient()` (bypasses RLS via `service_role` key), `public.audit_logs`, `public.admin_broadcasts`.
* **Data Flow**: Super-Admin accesses `/admin/*` → Service-role client queries all businesses/logs → Admin trigger or action executed → Broadcast stored in `admin_broadcasts` → Rendered globally on owner dashboards.
* **Files Involved**:
  * `src/app/admin/activity/page.tsx`
  * `src/app/admin/ai-logs/page.tsx`
  * `src/app/admin/broadcasts/page.tsx`
  * `src/app/admin/businesses/page.tsx`
  * `src/components/admin/*`
* **Inter-subsystem Communication**: Inspects and manages all tenant data across **Database**, **Auth**, **Payments**, and **Notifications Subsystems**.

---

### 10. Scheduling Subsystem
* **Purpose**: Manages business availability constraints including weekly working shifts, default buffer times between appointments, minimum notice hours, maximum advance booking limits, and specific blocked dates/time ranges.
* **Entry Point**: `src/app/dashboard/availability/page.tsx`.
* **Dependencies**: Tables `public.availability`, `public.blocked_dates`, `public.blocked_times`.
* **Data Flow**: Business owner updates hours or blocks dates → `POST /api/availability` or `POST /api/blocked-dates` → Supabase table updated → Consumed during slot generation.
* **Files Involved**:
  * `src/app/dashboard/availability/page.tsx`
  * `src/app/api/availability/route.ts`
  * `src/app/api/blocked-dates/route.ts`
  * `src/app/api/blocked-times/route.ts`
* **Inter-subsystem Communication**: Feeds operational constraint rules into the **Booking Engine Subsystem**.

---

### 11. Clients Subsystem
* **Purpose**: Multi-tenant customer CRM tracking client history, visit counts, phone numbers, client types (regular, VIP, model), and client-side self-service account portals.
* **Entry Point**: `src/app/dashboard/clients/page.tsx` & `src/app/client/login/page.tsx`.
* **Dependencies**: Tables `public.clients`, `public.client_groups`, `public.appointments`.
* **Data Flow**: Appointment created → SQL function upserts `public.clients` record by phone/email → Displayed in Owner Client Panel → Client logs into `/client/appointments` to manage bookings.
* **Files Involved**:
  * `src/app/dashboard/clients/page.tsx`
  * `src/components/dashboard/ClientsPanel.tsx`
  * `src/app/client/appointments/page.tsx`
  * `supabase/migrations/013_client_accounts.sql` & `015_client_groups.sql`
* **Inter-subsystem Communication**: Populated automatically by **Booking Engine** and **Telegram Subsystem**; displayed in **Dashboard Subsystem**.

---

### 12. Payments Subsystem
* **Purpose**: Handles deposit enforcement, manual bank transfer receipt uploads with owner review workflows, Stripe Checkout session generation, and Stripe webhook synchronization.
* **Entry Point**: `/api/payments/stripe-checkout` & `/api/payments/upload-receipt`.
* **Dependencies**: Stripe SDK (`stripeCheckoutProvider.ts`), Supabase Storage (`payment-receipts`).
* **Data Flow**: Client books appointment needing deposit → Chooses Stripe or Manual Receipt → If Stripe: `/api/payments/stripe-checkout` generates session URL → Client pays → Stripe Webhooks updates payment status to `confirmed` → Fires `trigger_log_payment_update` audit log.
* **Files Involved**:
  * `src/services/payments/stripeCheckoutProvider.ts`
  * `src/app/api/payments/stripe-checkout/route.ts`
  * `src/app/api/payments/stripe-webhook/route.ts`
  * `src/app/api/payments/upload-receipt/route.ts`
  * `src/components/dashboard/PaymentsPanel.tsx`
* **Inter-subsystem Communication**: Coordinates with **Booking Engine**, **Supabase Storage**, **Stripe API**, and **Notifications Subsystem**.

---

### 13. Telegram Integration Subsystem
* **Purpose**: Provides automated conversational booking over Telegram Bot API using a state machine running within serverless webhooks.
* **Entry Point**: `src/app/api/webhooks/telegram/route.ts`.
* **Dependencies**: `telegramService.ts`, `bookingAutomation.ts`, `chat_conversations`, `telegram_integrations`.
* **Data Flow**: Client sends Telegram message → Webhook `POST /api/webhooks/telegram` → Verifies `x-telegram-bot-api-secret-token` → Loads state from `chat_conversations` → `processMessage()` state machine advances step → On confirm: calls `create_public_booking` RPC → Pushes reply to Telegram API via `sendTelegramMessage()`.
* **Files Involved**:
  * `src/app/api/webhooks/telegram/route.ts`
  * `src/services/notifications/telegramService.ts`
  * `src/services/notifications/bookingAutomation.ts`
  * `supabase/migrations/017_channels_integration.sql`
* **Inter-subsystem Communication**: Connects Telegram API directly to **Booking Engine Subsystem** and **Database Subsystem**.

---

### 14. Shared Utilities Subsystem
* **Purpose**: Provides foundational cross-cutting helpers for data formatting, token encryption, environment safety checks, Zod validation schemas, and rate limiting.
* **Entry Point**: `src/lib/`.
* **Dependencies**: Node.js `crypto`, `zod`.
* **Data Flow**: Invocations by API routes, server components, and client panels across the repository.
* **Files Involved**:
  * `src/lib/encryption.ts` (AES-256-CBC token encryption)
  * `src/lib/env.ts` (Strict env var resolution)
  * `src/lib/format.ts` (Currency & Date formatters)
  * `src/lib/rate-limit.ts` (Sliding window rate limiter)
  * `src/lib/types.ts` (TypeScript interfaces)
  * `src/lib/validators.ts` (Validation schemas)
* **Inter-subsystem Communication**: Imported and consumed by all 15 other subsystems.

---

### 15. Services Subsystem
* **Purpose**: Encapsulates external third-party SDK connections (Stripe, Meta/WhatsApp Cloud API, Telegram Bot API) and future feature provider placeholders.
* **Entry Point**: `src/services/`.
* **Dependencies**: External APIs, Node fetch runtime.
* **Data Flow**: Application action → Service method called → Outbound HTTP request dispatched → Response parsed and returned to calling route.
* **Files Involved**:
  * `src/services/payments/stripeCheckoutProvider.ts`
  * `src/services/notifications/telegramService.ts`
  * `src/services/notifications/whatsappService.ts`
  * `src/services/notifications/bookingAutomation.ts`
* **Inter-subsystem Communication**: Invoked by **API Routes Subsystem** to perform external network I/O.

---

### 16. Components Subsystem
* **Purpose**: Contains reusable React UI elements, layout navigation menus, full operational dashboard panels, interactive booking flow wizards, and animated loaders.
* **Entry Point**: `src/components/`.
* **Dependencies**: React 19 Client Hooks (`useState`, `useEffect`, `useMemo`), Lucide Icons, Tailwind CSS.
* **Data Flow**: Parent Page renders Component → Component manages local UI state → Dispatches HTTP requests to API Routes → Renders updated view.
* **Files Involved**:
  * `src/components/BookNestLoader.tsx`
  * `src/components/FriendlyError.tsx`
  * `src/components/admin/*`
  * `src/components/auth/*`
  * `src/components/booking/*`
  * `src/components/dashboard/*`
* **Inter-subsystem Communication**: Serves as the UI rendering engine for the **Frontend Subsystem** and dispatches actions to the **Backend Subsystem**.
