# BookNest — System Architecture & Reverse Engineering Specification

---

## 1. High-Level Architecture Overview

**BookNest** is a multi-tenant SaaS appointment management platform built for service businesses (beauty salons, spas, independent contractors). The application allows business owners to organize service catalogs, define operating availability, process client bookings, handle payments (manual bank transfers and Stripe Checkout), manage client accounts, and automate messaging via AI and chat channels (WhatsApp and Telegram).

```
                 ┌─────────────────────────────────────────────────────────┐
                 │                   Clients & Business                    │
                 │              (Browser, Mobile, Webhooks)                │
                 └──────────────────────────┬──────────────────────────────┘
                                            │
                                            ▼
                 ┌─────────────────────────────────────────────────────────┐
                 │                 Next.js 16 App Router                   │
                 │      (React 19 / Server Components / API Routes)       │
                 └───────┬──────────────────┬──────────────────┬───────────┘
                         │                  │                  │
                         ▼                  ▼                  ▼
┌──────────────────────────────┐ ┌────────────────────┐ ┌────────────────────┐
│      Supabase PostgreSQL     │ │   Vercel AI SDK    │ │   Stripe / Meta    │
│  (RLS, Triggers, RPC, Auth)  │ │   (Groq / Llama)   │ │  (Webhooks/Pay)    │
└──────────────────────────────┘ └────────────────────┘ └────────────────────┘
```

### Technology Stack Matrix
* **Frontend Framework**: Next.js 16 (App Router), React 19, TypeScript
* **Styling & Icons**: Tailwind CSS v3, Lucide React
* **Backend Database & Auth**: Supabase PostgreSQL (22 SQL migrations), Supabase Auth (SSR Client), Storage Buckets (`business-logos`, `payment-receipts`)
* **AI Copilot**: Vercel AI SDK (`ai/react`), Groq API (`llama-3.3-70b-versatile`)
* **Rate Limiting**: In-memory token bucket (`src/lib/rate-limit.ts`)
* **Deployment & Containerization**: Docker (`Dockerfile` multi-stage), Docker Compose, Vercel

---

## 2. Directory Tree Topology

```
Acuity/
├── .dockerignore
├── .env.example
├── .env.local
├── .gitignore
├── Dockerfile
├── README.md
├── docker-compose.yml
├── good-first-issues.md
├── next.config.ts
├── package.json
├── pnpm-lock.yaml
├── postcss.config.js
├── tailwind.config.ts
├── tsconfig.json
├── public/
├── src/
│   ├── app/
│   │   ├── admin/
│   │   │   ├── activity/
│   │   │   ├── ai-logs/
│   │   │   ├── broadcasts/
│   │   │   ├── businesses/
│   │   │   │   └── [id]/
│   │   │   └── exports/
│   │   ├── api/
│   │   │   ├── admin/
│   │   │   │   ├── ai-logs/messages/
│   │   │   │   ├── broadcasts/
│   │   │   │   ├── businesses/[id]/
│   │   │   │   ├── exports/
│   │   │   │   └── impersonate/
│   │   │   ├── ai/
│   │   │   │   ├── copilot/
│   │   │   │   └── transcribe/
│   │   │   ├── appointments/
│   │   │   │   └── [id]/status/
│   │   │   ├── availability/
│   │   │   ├── blocked-dates/
│   │   │   ├── blocked-times/
│   │   │   ├── business/
│   │   │   │   ├── [slug]/
│   │   │   │   ├── logo/
│   │   │   │   └── settings/
│   │   │   ├── client/
│   │   │   │   └── appointments/[id]/cancel/
│   │   │   ├── coupons/
│   │   │   │   └── validate/
│   │   │   ├── cron/
│   │   │   │   └── subscriptions/
│   │   │   ├── dashboard/
│   │   │   │   ├── billing/
│   │   │   │   ├── catalog/
│   │   │   │   └── integrations/
│   │   │   ├── discounts/
│   │   │   │   └── preview/
│   │   │   ├── notifications/
│   │   │   │   └── [id]/read/
│   │   │   ├── payments/
│   │   │   │   ├── [id]/
│   │   │   │   │   ├── confirm/
│   │   │   │   │   └── reject/
│   │   │   │   ├── config/
│   │   │   │   ├── stripe-checkout/
│   │   │   │   ├── stripe-webhook/
│   │   │   │   └── upload-receipt/
│   │   │   ├── reminders/
│   │   │   │   └── send/
│   │   │   ├── service-addons/
│   │   │   ├── service-categories/
│   │   │   ├── service-options/
│   │   │   ├── services/
│   │   │   ├── slots/
│   │   │   └── webhooks/
│   │   │       ├── telegram/
│   │   │       └── whatsapp/
│   │   ├── book/
│   │   │   └── [businessSlug]/
│   │   ├── client/
│   │   │   ├── appointments/
│   │   │   ├── login/
│   │   │   ├── register/
│   │   │   └── settings/
│   │   ├── dashboard/
│   │   │   ├── add-ons/
│   │   │   ├── appointments/
│   │   │   ├── availability/
│   │   │   ├── billing/
│   │   │   ├── calendar/
│   │   │   ├── clients/
│   │   │   ├── coupons/
│   │   │   ├── discounts/
│   │   │   ├── embed-code/
│   │   │   ├── integrations/
│   │   │   ├── notifications/
│   │   │   ├── payments/
│   │   │   ├── reminders/
│   │   │   ├── service-categories/
│   │   │   ├── service-options/
│   │   │   ├── services/
│   │   │   ├── settings/
│   │   │   ├── setup/
│   │   │   └── transfer-owner/
│   │   ├── embed/
│   │   │   └── [businessSlug]/
│   │   ├── forgot-password/
│   │   ├── impersonate/
│   │   ├── login/
│   │   ├── logout/
│   │   ├── reset-password/
│   │   ├── signup/
│   │   ├── error.tsx
│   │   ├── global-error.tsx
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   ├── loading.tsx
│   │   ├── not-found.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── BookNestLoader.tsx
│   │   ├── FriendlyError.tsx
│   │   ├── admin/
│   │   │   ├── AILogViewer.tsx
│   │   │   ├── AdminNav.tsx
│   │   │   ├── BroadcastManager.tsx
│   │   │   ├── BusinessActions.tsx
│   │   │   └── ExportActions.tsx
│   │   ├── auth/
│   │   │   └── AuthCard.tsx
│   │   ├── booking/
│   │   │   └── BookingFlow.tsx
│   │   └── dashboard/
│   │       ├── AppointmentsPanel.tsx
│   │       ├── BillingPanel.tsx
│   │       ├── BookNestCopilot.tsx
│   │       ├── ClientsPanel.tsx
│   │       ├── DashboardNav.tsx
│   │       ├── EmbedCodePanel.tsx
│   │       ├── IntegrationsPanel.tsx
│   │       ├── OnboardingPanel.tsx
│   │       ├── PaymentsPanel.tsx
│   │       └── ServicesPanel.tsx
│   ├── lib/
│   │   ├── api.ts
│   │   ├── coupons.ts
│   │   ├── encryption.ts
│   │   ├── env.ts
│   │   ├── format.ts
│   │   ├── rate-limit.ts
│   │   ├── reminders.ts
│   │   ├── service-discounts.ts
│   │   ├── types.ts
│   │   ├── validators.ts
│   │   ├── booking/
│   │   │   └── availability.ts
│   │   └── supabase/
│   │       ├── admin.ts
│   │       ├── browser.ts
│   │       └── server.ts
│   └── services/
│       ├── calendar/
│       │   └── futureGoogleCalendarProvider.ts
│       ├── coupons/
│       ├── notifications/
│       │   ├── bookingAutomation.ts
│       │   ├── browserNotificationHelper.ts
│       │   ├── emailProviderStatus.ts
│       │   ├── futureEmailProvider.ts
│       │   ├── futureSmsProvider.ts
│       │   ├── futureWhatsAppProvider.ts
│       │   ├── inAppNotificationService.ts
│       │   ├── manualEmailTemplateService.ts
│       │   ├── manualWhatsAppService.ts
│       │   ├── telegramService.ts
│       │   └── whatsappService.ts
│       ├── packages/
│       ├── payments/
│       │   ├── futurePaystackProvider.ts
│       │   ├── futureStripeProvider.ts
│       │   └── stripeCheckoutProvider.ts
│       ├── reminders/
│       ├── reviews/
│       ├── staff/
│       └── widget/
└── supabase/
    ├── config.toml
    ├── seed.sql
    ├── storage-setup.md
    └── migrations/
        ├── 001_initial_booknest_schema.sql
        ├── ... (002 to 021)
        └── 022_unify_audit_logs_schema.sql
```

---

## 3. Subsystem Breakdown

### A. Core Web Application (`src/app/`)
* **Purpose**: Hosts Next.js routes, server components, and API REST endpoints.
* **Key Sections**:
  * `/dashboard`: Owner admin pages (appointments, services, clients, availability, settings, billing).
  * `/book/[businessSlug]`: Public-facing client booking interface.
  * `/embed/[businessSlug]`: Lightweight responsive iframe version for external website embedding.
  * `/admin`: Super Admin console (CRM features, business management, AI Watcher logs, Live Activity feed).
* **Dependencies**: Depends on `src/components/`, `src/lib/`, and `src/services/`.

### B. UI Component Library (`src/components/`)
* **Purpose**: Holds client components, UI layout controls, modal forms, and interactive panels.
* **Sub-directories**:
  * `dashboard/`: Complex operational views like `AppointmentsPanel.tsx`, `IntegrationsPanel.tsx`, `BookNestCopilot.tsx`.
  * `admin/`: Super admin controls like `AILogViewer.tsx` and `BroadcastManager.tsx`.
  * `booking/`: `BookingFlow.tsx` which drives public client wizard.
* **Dependencies**: Consumes data types from `src/lib/types.ts` and API utilities from `src/lib/api.ts`.

### C. System Utility & Infrastructure (`src/lib/`)
* **Purpose**: Core business algorithms, environment secrets verification, security helpers, and Supabase client initializers.
* **Key Files**:
  * `lib/booking/availability.ts`: Slot availability engine factoring in working hours, blocked dates/times, and existing appointments.
  * `lib/supabase/`: Three tier clients (`server.ts` for SSR cookies, `browser.ts` for Client components, `admin.ts` using `service_role` key to bypass RLS for background jobs).
  * `lib/rate-limit.ts`: Sliding window rate limiter to prevent API abuse.
  * `lib/encryption.ts`: AES-256-CBC token encryption for third-party access tokens stored in PostgreSQL.

### D. Services & Automated Integrations (`src/services/`)
* **Purpose**: Contains external API connectors (Stripe, WhatsApp, Telegram) and background state machine automations.
* **Key Sub-modules**:
  * `services/notifications/bookingAutomation.ts`: Finite State Machine processing chat messages into bookings via Supabase RPC.
  * `services/notifications/whatsappService.ts` & `telegramService.ts`: Webhook handlers and outbound message push.

---

## 4. Key Module Reference Specifications

### 1. `src/lib/booking/availability.ts`
* **Responsibility**: Computes available time slots for a business on a specific date.
* **Exported Functions**:
  * `generateAvailableSlots(input: SlotInput)`
  * `getBookingDurationMinutes(service, option, addons)`
  * `getBookingPrice(service, option, addons)`
* **Caller Sites**: `src/app/api/slots/route.ts`, `src/services/notifications/bookingAutomation.ts`.

### 2. `src/services/notifications/bookingAutomation.ts`
* **Responsibility**: Runs the WhatsApp/Telegram conversational booking state machine.
* **Exported Functions**:
  * `processMessage(supabase, businessId, businessSlug, externalChatId, customerName, state, text)`
  * `createBooking(...)`
* **Called By**: Webhook endpoints `src/app/api/webhooks/telegram/route.ts` and `src/app/api/webhooks/whatsapp/route.ts`.
* **Callees**: Calls `supabase.rpc("create_public_booking")` and `generateAvailableSlots()`.

### 3. `src/app/api/ai/copilot/route.ts`
* **Responsibility**: Vercel AI SDK endpoint powering the BookNest Onboarding Copilot.
* **Exported Handlers**: `POST(req)`
* **Called By**: `src/components/dashboard/BookNestCopilot.tsx`.
* **Callees**: Invokes Groq Llama 3.3 model and executes custom tool `save_services` to insert services into Supabase database.

### 4. `src/app/impersonate/page.tsx`
* **Responsibility**: Handles super-admin session delegation. Signs out current admin, extracts magic link tokens, and sets target business owner session cookies.
* **Exported Component**: `ImpersonateCallbackPage`
* **Called By**: `/api/admin/impersonate` route redirects here.

---

## 5. PostgreSQL Schema & Security Architecture

The database is built on Supabase PostgreSQL and governed by 22 migration scripts in `supabase/migrations/`:

```
┌────────────────────────┐      ┌────────────────────────┐
│       businesses       │◄─────┤        services        │
└───────────┬────────────┘      └───────────┬────────────┘
            │                               │
            ▼                               ▼
┌────────────────────────┐      ┌────────────────────────┐
│        clients         │◄─────┤      appointments      │
└────────────────────────┘      └───────────┬────────────┘
                                            │
                                            ▼
                                ┌────────────────────────┐
                                │       audit_logs       │
                                └────────────────────────┘
```

### Security & Isolation Controls
* **Row-Level Security (RLS)**: Enforced on all tables. Owners can only query data matching `owns_business(business_id)`.
* **Public Booking Safety**: Booking creation is handled via `SECURITY DEFINER` function `create_public_booking`, avoiding direct client inserts into `appointments`.
* **Advisory Locks**: `create_public_booking` executes `pg_advisory_xact_lock(hashtext(v_business.id::text || ':' || p_appointment_date::text))` to prevent double-booking race conditions.
* **Automated Audit Logging**: Triggers on `businesses`, `appointments`, and `payments` automatically write event logs to `public.audit_logs (id, business_id, user_id, event_type, message, created_at)`.
