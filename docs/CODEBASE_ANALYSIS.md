# BookNest — Complete Codebase Dependency Analysis

> Derived from static import tracing across every `.ts` and `.tsx` file.
> Every claim is verified from actual source code.

---

## Table of Contents

1. [File Inventory](#file-inventory)
2. [Dependency Graph (text form)](#dependency-graph)
3. [Layer-by-Layer Breakdown](#layer-by-layer-breakdown)
4. [Unused / Dead Files](#unused--dead-files)
5. [High Import Count (Most Depended-On Files)](#high-import-count--most-depended-on-files)
6. [Files Ranked by Importance](#files-ranked-by-importance)
7. [Duplicate Code & Logic Smell](#duplicate-code--logic-smell)
8. [Circular Dependencies](#circular-dependencies)
9. [Architecture Smells](#architecture-smells)
10. [High-Risk Files](#high-risk-files)
11. [Core Business Logic Map](#core-business-logic-map)

---

## File Inventory

### `src/lib/` — Shared Utilities & Infrastructure

| File | Size | Role | Entry Point? | Shared? |
|---|---|---|---|---|
| `lib/api.ts` | 1.7 KB | Response helpers + auth middleware | No | **Yes — imported by 50+ API routes** |
| `lib/booking/availability.ts` | 4.5 KB | Slot generation + price/duration math | No | Yes — 4 importers |
| `lib/coupons.ts` | 10.6 KB | Coupon validation engine | No | Yes — 2 importers |
| `lib/service-discounts.ts` | 8.6 KB | Automatic discount engine | No | Yes — 2 importers |
| `lib/validators.ts` | 7.2 KB | Zod schemas for all API inputs | No | Yes — 18 importers |
| `lib/types.ts` | 7.3 KB | TypeScript types / interfaces | No | **Yes — 21 importers** |
| `lib/format.ts` | 2.0 KB | Date, time, currency, slug formatters | No | Yes — 18 importers |
| `lib/env.ts` | 1.4 KB | Typed env var accessors | No | Yes — 13 importers |
| `lib/encryption.ts` | 1.4 KB | AES-256 encrypt/decrypt | No | Yes — 4 importers |
| `lib/rate-limit.ts` | 1.0 KB | In-memory rate limiter | No | Yes — 7 importers |
| `lib/reminders.ts` | 1.4 KB | Reminder query helpers | No | Yes — 5 importers |
| `lib/supabase/server.ts` | 810 B | Server-side Supabase client factory | No | **Yes — 34 importers** |
| `lib/supabase/admin.ts` | 465 B | Admin/service-role Supabase client | No | Yes — 17 importers |
| `lib/supabase/browser.ts` | 339 B | Browser-side Supabase client factory | No | Yes — 7 importers |

---

### `src/services/` — Domain Service Layer

| File | Size | Role | Entry Point? | Shared? |
|---|---|---|---|---|
| `services/notifications/bookingAutomation.ts` | 29.5 KB | Telegram/WA FSM state machine | No | Yes — 2 webhook routes |
| `services/notifications/telegramService.ts` | 4.1 KB | Telegram Bot API helpers | No | Yes — 5 importers |
| `services/notifications/whatsappService.ts` | 4.6 KB | WhatsApp Cloud API helpers | No | Yes — 3 importers |
| `services/notifications/manualEmailTemplateService.ts` | 2.5 KB | Email template builder (manual send) | No | Yes — 1 importer |
| `services/notifications/manualWhatsAppService.ts` | 2.8 KB | wa.me link & template builder | No | Yes — 2 importers |
| `services/notifications/inAppNotificationService.ts` | 903 B | In-app notification factory | No | **0 importers — DEAD** |
| `services/notifications/browserNotificationHelper.ts` | 642 B | Push notification request helper | No | Yes — 1 importer |
| `services/notifications/emailProviderStatus.ts` | 1.5 KB | Email config status checker | No | Yes — 1 importer |
| `services/payments/stripeCheckoutProvider.ts` | 1.8 KB | Stripe Checkout session creator | No | Yes — 1 importer |
| `services/notifications/futureEmailProvider.ts` | 386 B | Stub placeholder | No | **DEAD — 0 importers** |
| `services/notifications/futureSmsProvider.ts` | 283 B | Stub placeholder | No | **DEAD — 0 importers** |
| `services/notifications/futureWhatsAppProvider.ts` | 305 B | Stub placeholder | No | **DEAD — 0 importers** |
| `services/payments/futureStripeProvider.ts` | 302 B | Stub placeholder | No | **DEAD — 0 importers** |
| `services/payments/futurePaystackProvider.ts` | 300 B | Stub placeholder | No | **DEAD — 0 importers** |
| `services/calendar/futureGoogleCalendarProvider.ts` | 299 B | Stub placeholder | No | **DEAD — 0 importers** |
| `services/coupons/futureCouponsProvider.ts` | 300 B | Stub placeholder | No | **DEAD — 0 importers** |
| `services/packages/futurePackagesMemberships.ts` | 285 B | Stub placeholder | No | **DEAD — 0 importers** |
| `services/reminders/futureSupabaseEdgeFunctionReminders.ts` | 329 B | Stub placeholder | No | **DEAD — 0 importers** |
| `services/reviews/futureReviewsProvider.ts` | 258 B | Stub placeholder | No | **DEAD — 0 importers** |
| `services/staff/futureStaffScheduling.ts` | 306 B | Stub placeholder | No | **DEAD — 0 importers** |
| `services/widget/futureJavascriptWidget.ts` | 329 B | Stub placeholder | No | **DEAD — 0 importers** |

---

### `src/components/` — UI Components

| File | Size | Imported By |
|---|---|---|
| `components/booking/BookingFlow.tsx` | 54.6 KB | `/book/[slug]/page.tsx`, `/embed/[slug]/page.tsx` |
| `components/dashboard/DashboardNav.tsx` | 10.3 KB | `dashboard/layout.tsx` |
| `components/dashboard/BookNestCopilot.tsx` | 6.9 KB | `dashboard/layout.tsx` |
| `components/dashboard/AppointmentsPanel.tsx` | 15.8 KB | `dashboard/appointments/page.tsx` |
| `components/dashboard/AvailabilityPanel.tsx` | 21.7 KB | `dashboard/availability/page.tsx` |
| `components/dashboard/BillingPanel.tsx` | 10.9 KB | `dashboard/billing/page.tsx` |
| `components/dashboard/CalendarPanel.tsx` | 11.1 KB | `dashboard/calendar/page.tsx` |
| `components/dashboard/CatalogManager.tsx` | 26.3 KB | 4 dashboard pages (services, add-ons, categories, options) |
| `components/dashboard/ClientsPanel.tsx` | 17.8 KB | `dashboard/clients/page.tsx` |
| `components/dashboard/CouponsPanel.tsx` | 23.7 KB | `dashboard/coupons/page.tsx` |
| `components/dashboard/DiscountsPanel.tsx` | 17.2 KB | `dashboard/discounts/page.tsx` |
| `components/dashboard/EmbedCodePanel.tsx` | 5.5 KB | `dashboard/embed-code/page.tsx` |
| `components/dashboard/IntegrationsPanel.tsx` | 33.7 KB | `dashboard/integrations/page.tsx` |
| `components/dashboard/NotificationsPanel.tsx` | 3.2 KB | `dashboard/notifications/page.tsx` |
| `components/dashboard/OnboardingPanel.tsx` | 9.7 KB | `dashboard/setup/page.tsx` |
| `components/dashboard/OwnerTransferPanel.tsx` | 7.0 KB | `dashboard/transfer-owner/page.tsx` |
| `components/dashboard/PaymentsPanel.tsx` | 13.0 KB | `dashboard/payments/page.tsx` |
| `components/dashboard/RemindersPanel.tsx` | 5.4 KB | `dashboard/reminders/page.tsx` |
| `components/dashboard/SettingsPanel.tsx` | 16.5 KB | `dashboard/settings/page.tsx` |
| `components/auth/AuthCard.tsx` | 5.4 KB | `login/`, `signup/`, `client/login/`, `client/signup/` |
| `components/auth/ForgotPasswordCard.tsx` | 1.6 KB | `forgot-password/page.tsx` |
| `components/auth/ResetPasswordCard.tsx` | 1.6 KB | `reset-password/page.tsx` |
| `components/admin/AdminNav.tsx` | 1.8 KB | `admin/layout.tsx` |
| `components/admin/BroadcastManager.tsx` | 7.3 KB | `admin/broadcasts/page.tsx` |
| `components/admin/BusinessActions.tsx` | 5.2 KB | `admin/businesses/[id]/page.tsx` |
| `components/admin/ExportActions.tsx` | 3.3 KB | `admin/exports/page.tsx` |
| `components/admin/AILogViewer.tsx` | 4.9 KB | `admin/ai-logs/page.tsx` |
| `components/BookNestLoader.tsx` | 661 B | **15+ consumers** across all panels |
| `components/FriendlyError.tsx` | 3.0 KB | `error.tsx`, `global-error.tsx`, `not-found.tsx` + 2 more |

---

### Critical API Routes

| Route | Rate-Limited? | Admin Client? | Key Logic |
|---|---|---|---|
| `api/appointments/route.ts` | **Yes (8/min)** | **Yes** | Booking entry point; orchestrates rate limiting, validation, discount, coupon, RPC |
| `api/slots/route.ts` | No | **Yes** | Calls `generateAvailableSlots()` |
| `api/payments/stripe-checkout/route.ts` | **Yes** | **Yes** | Creates Stripe session |
| `api/payments/stripe-webhook/route.ts` | No | **Yes** | Verifies & processes Stripe payment |
| `api/payments/upload-receipt/route.ts` | **Yes** | **Yes** | Handles manual receipt uploads |
| `api/payments/[id]/confirm/route.ts` | No | No | Manual payment confirm |
| `api/payments/[id]/reject/route.ts` | No | No | Manual payment reject + audit log |
| `api/appointments/[id]/status/route.ts` | No | No | Status update + audit log |
| `api/webhooks/telegram/route.ts` | **Yes** | **Yes** | Telegram bot entry point |
| `api/webhooks/whatsapp/route.ts` | **Yes** | No | WhatsApp bot entry point |
| `api/coupons/validate/route.ts` | **Yes** | **Yes** | Public coupon validation |
| `api/discounts/preview/route.ts` | **Yes** | **Yes** | Discount preview (anonymous) |
| `api/cron/reminders/route.ts` | No | **Yes** | Cron job — sends reminders |
| `api/cron/subscriptions/route.ts` | No | **Yes** | Cron job — subscription checks |
| `api/ai/copilot/route.ts` | No | No | AI copilot (Vercel AI SDK) |
| `api/admin/impersonate/route.ts` | No | **Yes** | Session impersonation |

---

## Dependency Graph

```
                         ┌──────────────┐
                         │  lib/env.ts  │  ← 13 importers
                         └──────┬───────┘
                ┌───────────────┼───────────────────────┐
                ▼               ▼                       ▼
       supabase/admin.ts  supabase/server.ts     lib/encryption.ts
            (17)               (34)                   (4)
              │                 │                      │
              └────────┬────────┘             telegramService.ts
                       ▼                      whatsappService.ts
                  lib/api.ts ← 50+ API route importers
                       │
        ┌──────────────┼──────────────────────────────┐
        ▼              ▼                              ▼
   API Routes      lib/types.ts ← 21 importers    lib/format.ts ← 18 importers
   (all routes)         │                                │
                        ▼                               ▼
                lib/booking/             dashboard panels (all 18)
                availability.ts          booking components
                (4 importers)            service templates
                        │
               ┌────────┴────────┐
               ▼                 ▼
         slots/route.ts   appointments/route.ts
         BookingFlow.tsx  bookingAutomation.ts

  lib/validators.ts ←── 18 API routes
  lib/coupons.ts ←────── coupons/validate + appointments (2 routes)
  lib/service-discounts.ts ← discounts/preview + appointments (2 routes)
  lib/rate-limit.ts ←───── 7 critical public routes
  lib/reminders.ts ←─────── 5 reminder routes

  bookingAutomation.ts ←── webhooks/telegram + webhooks/whatsapp (2 routes)

  BookingFlow.tsx (54 KB, the largest component)
   └── imported by: book/[slug]/page.tsx, embed/[slug]/page.tsx

  BookNestLoader.tsx ← 15+ consumers (all dashboard panels + app/loading)
  FriendlyError.tsx ← error.tsx, global-error.tsx, not-found.tsx + 2 more
```

---

## Layer-by-Layer Breakdown

### Layer 0 — Leaf Nodes (no internal project imports)
- `lib/env.ts` — reads `process.env` only
- `lib/rate-limit.ts` — pure in-memory Map
- `lib/encryption.ts` — Node.js `crypto` only
- `lib/supabase/browser.ts` — `@supabase/ssr` only
- `components/BookNestLoader.tsx` — pure UI
- `components/FriendlyError.tsx` — pure UI
- All `future*.ts` stubs — pure comment placeholders

### Layer 1 — Core Infrastructure (imported by many)
- `lib/env.ts` → 13 importers
- `lib/types.ts` → 21 importers
- `lib/format.ts` → 18 importers
- `lib/supabase/server.ts` → 34 importers
- `lib/supabase/admin.ts` → 17 importers
- `lib/api.ts` → 50+ importers

### Layer 2 — Domain Logic
- `lib/booking/availability.ts` → 4 importers
- `lib/coupons.ts` → 2 importers
- `lib/service-discounts.ts` → 2 importers
- `lib/validators.ts` → 18 importers
- `lib/reminders.ts` → 5 importers
- `lib/encryption.ts` → 4 importers
- `lib/rate-limit.ts` → 7 importers

### Layer 3 — Service Implementations
- `services/notifications/bookingAutomation.ts` → 2 importers
- `services/notifications/telegramService.ts` → 5 importers
- `services/notifications/whatsappService.ts` → 3 importers
- `services/payments/stripeCheckoutProvider.ts` → 1 importer

### Layer 4 — UI Components (1 importer each)
Each dashboard panel has exactly one page.tsx that imports it.

### Layer 5 — Entry Points
Pages in `app/`, API handlers in `app/api/` — top of the import tree.

---

## Unused / Dead Files

### Confirmed Dead Code (0 importers anywhere in the codebase)

| File | Size | Safe to Delete? |
|---|---|---|
| `services/notifications/futureEmailProvider.ts` | 386 B | **Yes** |
| `services/notifications/futureSmsProvider.ts` | 283 B | **Yes** |
| `services/notifications/futureWhatsAppProvider.ts` | 305 B | **Yes** |
| `services/payments/futureStripeProvider.ts` | 302 B | **Yes** |
| `services/payments/futurePaystackProvider.ts` | 300 B | **Yes** |
| `services/calendar/futureGoogleCalendarProvider.ts` | 299 B | **Yes** |
| `services/coupons/futureCouponsProvider.ts` | 300 B | **Yes** |
| `services/packages/futurePackagesMemberships.ts` | 285 B | **Yes** |
| `services/reminders/futureSupabaseEdgeFunctionReminders.ts` | 329 B | **Yes** |
| `services/reviews/futureReviewsProvider.ts` | 258 B | **Yes** |
| `services/staff/futureStaffScheduling.ts` | 306 B | **Yes** |
| `services/widget/futureJavascriptWidget.ts` | 329 B | **Yes** |
| **`services/notifications/inAppNotificationService.ts`** | 903 B | **Investigate** |

### `inAppNotificationService.ts` — Special Case
This file defines `createInAppNotification()` which inserts into the `notifications` table with formatted date/time labels. However, **it is never imported anywhere in the codebase**. All notification inserts happen inside PostgreSQL RPC functions (`create_public_booking`, `attach_public_receipt`) and the Stripe webhook route directly. This service layer was built but never adopted.

**Recommendation:** Either delete it or migrate the notification insert in `stripe-webhook/route.ts` to call this function for consistency.

---

## High Import Count — Most Depended-On Files

Ranked by number of unique files that import them:

| Rank | File | Importer Count | Risk Level |
|---|---|---|---|
| 1 | `lib/api.ts` | **50+** | 🔴 CRITICAL |
| 2 | `lib/supabase/server.ts` | **34** | 🔴 CRITICAL |
| 3 | `lib/types.ts` | **21** | 🔴 HIGH |
| 4 | `lib/format.ts` | **18** | 🟠 HIGH |
| 5 | `lib/validators.ts` | **18** | 🟠 HIGH |
| 6 | `lib/supabase/admin.ts` | **17** | 🟠 HIGH |
| 7 | `components/BookNestLoader.tsx` | **15** | 🟡 MEDIUM |
| 8 | `lib/env.ts` | **13** | 🟡 MEDIUM |
| 9 | `lib/rate-limit.ts` | **7** | 🟡 MEDIUM |
| 10 | `lib/supabase/browser.ts` | **7** | 🟡 MEDIUM |
| 11 | `services/notifications/telegramService.ts` | **5** | 🟢 LOW |
| 12 | `lib/reminders.ts` | **5** | 🟢 LOW |
| 13 | `lib/booking/availability.ts` | **4** | 🟡 MEDIUM (booking-critical) |
| 14 | `lib/encryption.ts` | **4** | 🟡 MEDIUM |

---

## Files Ranked by Importance

### Tier 1 — Mission Critical (breaks the entire app)

| Rank | File | Why |
|---|---|---|
| 1 | `lib/supabase/server.ts` | 34 files depend on this. If this breaks, every server DB call fails. |
| 2 | `lib/api.ts` | Authentication and response layer for 50+ routes. Breaks all authenticated API calls. |
| 3 | `lib/env.ts` | Provides all env vars to Supabase clients. App fails to initialize if this throws. |
| 4 | `lib/supabase/admin.ts` | Used for all RLS-bypassing operations. Breaks booking, webhooks, payment webhooks. |
| 5 | `lib/types.ts` | TypeScript contracts for 21 files. Type change cascades across all layers. |

### Tier 2 — Booking Engine (breaks new bookings)

| Rank | File | Why |
|---|---|---|
| 6 | `app/api/appointments/route.ts` | Main booking POST. Orchestrates all booking logic. |
| 7 | `app/api/slots/route.ts` | Every booking flow fetches available times through this. |
| 8 | `lib/booking/availability.ts` | `generateAvailableSlots()`, `getBookingDurationMinutes()`, `getBookingPrice()`. |
| 9 | `components/booking/BookingFlow.tsx` | The entire 54 KB public booking UI. |
| 10 | `lib/validators.ts` | All API input validation — wrong schemas = broken forms. |

### Tier 3 — Core Features

| Rank | File | Why |
|---|---|---|
| 11 | `services/notifications/bookingAutomation.ts` | FSM for Telegram + WhatsApp. 29.5 KB — all bot bookings depend on it. |
| 12 | `app/api/webhooks/telegram/route.ts` | Telegram bot entry point. |
| 13 | `app/api/payments/stripe-webhook/route.ts` | Payment confirmation from Stripe. |
| 14 | `lib/coupons.ts` | Coupon validation — breaks all coupon redemptions if faulty. |
| 15 | `lib/service-discounts.ts` | Auto-discount logic — breaks automatic pricing if faulty. |
| 16 | `lib/format.ts` | 18 consumers — silent display bugs across the whole UI. |
| 17 | `lib/encryption.ts` | Telegram/WhatsApp integration breaks if this fails. |

### Tier 4 — Dashboard UX (breaks operations, not booking)

| Rank | File | Why |
|---|---|---|
| 18 | `components/dashboard/DashboardNav.tsx` | Nav for the entire dashboard layout. |
| 19 | `components/dashboard/CatalogManager.tsx` | Manages all services, options, addons (26.3 KB, 4 routes). |
| 20 | `components/dashboard/AppointmentsPanel.tsx` | Primary daily tool for business owners. |
| 21 | `components/dashboard/IntegrationsPanel.tsx` | Manages Telegram/WhatsApp config (33.7 KB). |
| 22 | `components/dashboard/AvailabilityPanel.tsx` | Controls when clients can book. |
| 23 | `components/auth/AuthCard.tsx` | Login/signup for owners and clients. |

### Tier 5 — Supporting & Roadmap Stubs (no break risk)

| Rank | File | Why |
|---|---|---|
| 24–34 | All `future*.ts` stubs | Zero importers. Pure placeholder comments. |
| 35 | `services/notifications/inAppNotificationService.ts` | Dead code (no importers). |

---

## Duplicate Code & Logic Smell

### 1. Notification Insertion — Three Separate Patterns

The same concept — insert a notification row — appears in three completely different places:

**Pattern A — Inside PostgreSQL RPC** (`create_public_booking()`, `attach_public_receipt()`):
```sql
INSERT INTO public.notifications (business_id, user_id, appointment_id, type, title, message)
VALUES (...);
```

**Pattern B — In API Route** (`stripe-webhook/route.ts`):
```typescript
await supabase.from("notifications").insert({ ... });
```

**Pattern C — In `inAppNotificationService.ts`** (defined but never called).

**Recommendation:** Decide on one authoritative notification path. The most consistent approach would be to move all notification creation into the DB layer (triggers or RPCs), eliminating the TypeScript patterns entirely.

---

### 2. `create_public_booking()` RPC Rewritten 4 Times in Migrations

Migrations 001, 003, 007, and 008 each replace the full PL/pgSQL body (~200 lines each). This is ~800 lines of near-identical migration code.

**Recommendation:** Break the RPC into composable helper functions so future changes only replace the affected function.

---

### 3. Inconsistent Supabase Admin Client Creation

Some routes wrap admin client creation defensively:
```typescript
let admin;
try {
  admin = createSupabaseAdminClient();
} catch {
  return fail("Booking is not configured on the server.", 500);
}
```

Others call it unconditionally. The inconsistency means some routes return structured 500 errors while others throw unhandled exceptions.

---

### 4. Dual WhatsApp Pattern

- `manualWhatsAppService.ts` → builds `wa.me/...` links (operator-clicks, no API)
- `whatsappService.ts` → calls WhatsApp Cloud API (automated bot)

Both are active and correct, but the naming is confusing. Neither name clearly signals "manual operator" vs "automated bot API."

---

## Circular Dependencies

**None detected.** The import graph is strictly layered:

```
Entry Points (pages / API routes)
      ↓ imports
Components / Service Implementations
      ↓ imports
Domain Logic (availability, coupons, service-discounts, validators)
      ↓ imports
Core Infrastructure (lib/api, lib/supabase/*, lib/env, lib/types)
      ↓ imports
External packages (Supabase, Stripe, Node.js)
```

No file imports from a layer above itself. The architecture is cleanly one-directional.

---

## Architecture Smells

### Smell 1 — `api/appointments/route.ts` Does Too Much (God Route)
Handles: rate limiting, Zod validation, business rule enforcement, price calculation, discount eligibility, coupon validation, RPC call, client profile linking, redemption inserts. **8+ responsibilities in one handler.**

**Recommendation:** Extract a booking orchestrator service: `createBookingOrchestrator(payload)`.

---

### Smell 2 — `BookingFlow.tsx` is 54 KB
A single React component covering service selection, date/time picking, form questions, coupon entry, receipt upload, and confirmation. Untestable as a unit.

**Recommendation:** Split into: `ServiceSelector`, `DateTimePicker`, `ClientForm`, `CouponEntry`, `BookingConfirmation`.

---

### Smell 3 — `IntegrationsPanel.tsx` is 33.7 KB
Handles Telegram setup, WhatsApp setup, conversation list, and reply UI in one file.

**Recommendation:** Split into `TelegramPanel`, `WhatsAppPanel`, `ConversationsView`.

---

### Smell 4 — `bookingAutomation.ts` is 29.5 KB
The FSM state machine for both Telegram and WhatsApp booking flows in one file. All states live in one giant switch-like dispatch.

**Recommendation:** Each FSM state should be its own handler module, orchestrated by a small dispatch table.

---

### Smell 5 — 12 Empty `services/` Stub Subdirectories
The `services/` tree has 9 subdirectories, 7 of which contain only a single `future*.ts` stub file. This creates an illusion of architecture while being functionally empty.

**Recommendation:** Delete the stubs (or move them to a `ROADMAP.md`) and collapse the empty directories.

---

### Smell 6 — Zero Test Files Found
No `*.test.ts`, `*.spec.ts`, or `__tests__/` directories anywhere in `src/`. The most critical paths — `generateAvailableSlots()`, `validateCoupon()`, the booking FSM, and the Stripe webhook — have **no automated tests**.

**Risk:** Any refactor can silently break production bookings.

---

## High-Risk Files

| File | Risk | Reason |
|---|---|---|
| `lib/supabase/server.ts` | 🔴 CRITICAL | 34 dependents |
| `lib/api.ts` | 🔴 CRITICAL | All API auth |
| `app/api/appointments/route.ts` | 🔴 CRITICAL | All new bookings |
| `app/api/payments/stripe-webhook/route.ts` | 🔴 CRITICAL | Stripe payments never confirmed if broken |
| `lib/booking/availability.ts` | 🔴 HIGH | No slots generated |
| `services/notifications/bookingAutomation.ts` | 🟠 HIGH | All bot bookings broken |
| `lib/validators.ts` | 🟠 HIGH | All API inputs rejected |
| `lib/coupons.ts` | 🟠 HIGH | Coupon redemption broken |
| `lib/encryption.ts` | 🟠 HIGH | Telegram/WA credentials inaccessible |
| `components/booking/BookingFlow.tsx` | 🟠 HIGH | Entire public booking UI fails |

---

## Core Business Logic Map

```
BOOKING
├── lib/booking/availability.ts          ← slot math, price/duration calc
├── app/api/appointments/route.ts        ← booking orchestration
├── app/api/slots/route.ts               ← available slots API
└── PostgreSQL: create_public_booking()  ← atomic booking transaction

PRICING
├── lib/coupons.ts                       ← code-based promo validation
├── lib/service-discounts.ts             ← automatic audience discounts
└── lib/booking/availability.ts          ← getBookingPrice(), getBookingDurationMinutes()

PAYMENTS
├── services/payments/stripeCheckoutProvider.ts  ← Stripe session creation
├── app/api/payments/stripe-webhook/route.ts     ← payment confirmation
├── app/api/payments/upload-receipt/route.ts     ← manual receipt flow
└── PostgreSQL: attach_public_receipt()          ← receipt atomic upsert

SCHEDULING
├── PostgreSQL: availability table              ← business hours
├── PostgreSQL: blocked_dates + blocked_times   ← date/time exceptions
└── lib/booking/availability.ts                 ← generateAvailableSlots()

TELEGRAM BOT
├── app/api/webhooks/telegram/route.ts           ← entry point
├── services/notifications/bookingAutomation.ts  ← FSM state machine
├── services/notifications/telegramService.ts    ← Telegram API calls
└── lib/booking/availability.ts                 ← slot gen mid-conversation

AUTHENTICATION
├── lib/supabase/server.ts           ← session reading
├── lib/supabase/browser.ts          ← client-side auth
├── lib/api.ts                       ← requireUser(), requireOwnedBusiness()
└── PostgreSQL: profiles + owns_business() ← role + ownership checks

AUDIT
├── PostgreSQL: trigger_log_new_appointment   ← auto-fires on booking
├── PostgreSQL: trigger_log_new_business      ← auto-fires on signup
├── PostgreSQL: trigger_log_payment_update    ← auto-fires on payment confirm
└── api/appointments/[id]/status/route.ts     ← manual audit log insert
```
