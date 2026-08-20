# BookNest — Complete Execution Flow Specification

Every sequence diagram below is derived from actual source code.
Each step is traceable to a real file, function, and database operation.

---

## 1. LOGIN FLOW

### User Story
A business owner enters their email and password and gains access to their dashboard.

### Sequence Diagram

```
Browser                  AuthCard.tsx              Supabase Auth             PostgreSQL (profiles)     Next.js Router
   |                         |                          |                             |                     |
   |--onSubmit(email, pwd)--->|                          |                             |                     |
   |                         |--signInWithPassword()---->|                             |                     |
   |                         |                          |--validates credentials------>|                     |
   |                         |                          |<--session token + user.id----|                     |
   |                         |<--{ user, session }------|                             |                     |
   |                         |                          |                             |                     |
   |                         |--SELECT role FROM profiles WHERE id = user.id--------->|                     |
   |                         |<--{ role: "business_owner" }--------------------------|                     |
   |                         |                          |                             |                     |
   |                         | [role check passes]       |                             |                     |
   |                         |--router.push("/dashboard")--------------------------------------------->|    |
   |<--redirect to /dashboard-|                          |                             |           router.refresh()
```

### Files Involved
| Step | File | Function |
|---|---|---|
| 1. Form submit | `src/components/auth/AuthCard.tsx:48` | `submit(event)` |
| 2. Auth call | `src/lib/supabase/browser.ts` | `createSupabaseBrowserClient()` |
| 3. Supabase call | `AuthCard.tsx:63` | `supabase.auth.signInWithPassword()` |
| 4. Role fetch | `AuthCard.tsx:92` | `supabase.from("profiles").select("role")` |
| 5. Redirect | `AuthCard.tsx:109` | `router.push("/dashboard")` |

### Error Paths
- Invalid credentials → `result.error.message` shown inline
- Wrong role (client account trying owner login) → `signOut()` + `wrongRoleMessage()` shown
- Profile missing → `signOut()` + error message shown

---

## 2. BOOKING FLOW

### User Story
A member of the public visits `/book/[businessSlug]`, selects a service, picks a date/time, enters their name and phone, and submits a booking.

### Sequence Diagram

```
Browser (BookingFlow.tsx)          /api/slots             /api/appointments          PostgreSQL RPC
   |                                   |                        |                         |
   |--1. Load /book/[slug] ----------->|                        |                         |
   |   (fetch service catalog)         |                        |                         |
   |                                   |                        |                         |
   |--2. Select date + service ------->|                        |                         |
   |   GET /api/slots?date=...&        |                        |                         |
   |   serviceId=...&slug=...          |                        |                         |
   |                                   |--generateAvailableSlots()--->                    |
   |                                   |  (availability.ts)     |                         |
   |                                   |  checks:               |                         |
   |                                   |  - availability table  |                         |
   |                                   |  - blocked_dates       |                         |
   |                                   |  - blocked_times       |                         |
   |                                   |  - booked_ranges RPC   |                         |
   |<--[list of HH:MM:SS slots]--------|                        |                         |
   |                                   |                        |                         |
   |--3. Confirm (POST /api/appointments)-------------------->  |                         |
   |   Payload: {                       |                        |                         |
   |     businessSlug, serviceId,       |                        |                         |
   |     appointmentDate, startTime,    |                        |                         |
   |     clientName, clientPhone,       |                        |                         |
   |     addonIds, formAnswers          |                        |                         |
   |   }                               |                        |                         |
   |                                   |                        |--rateLimit(8/min)------->|
   |                                   |                        |--Zod parse body          |
   |                                   |                        |--notice hours check      |
   |                                   |                        |--max advance days check  |
   |                                   |                        |--getBookingDurationMin() |
   |                                   |                        |--findServiceDiscount()   |
   |                                   |                        |--validateCoupon()        |
   |                                   |                        |--client conflict check   |
   |                                   |                        |                         |
   |                                   |                        |--admin.rpc("create_public_booking",{...})
   |                                   |                        |                         |
   |                                   |                        |        SQL FUNCTION:     |
   |                                   |                        |        1. businesses lookup
   |                                   |                        |        2. pg_advisory_xact_lock
   |                                   |                        |        3. services lookup
   |                                   |                        |        4. option validation
   |                                   |                        |        5. past date check
   |                                   |                        |        6. availability hours check
   |                                   |                        |        7. overlap check
   |                                   |                        |        8. INSERT clients (upsert)
   |                                   |                        |        9. INSERT appointments
   |                                   |                        |        10. TRIGGER: audit_logs insert
   |                                   |                        |        11. RETURN {appointment_id}
   |                                   |                        |                         |
   |                                   |                        |<--{ appointment_id }-----|
   |                                   |                        |                         |
   |                                   |                        | [if logged-in client]   |
   |                                   |                        |--UPDATE appointments SET client_auth_user_id
   |                                   |                        |                         |
   |                                   |                        | [if discount applied]   |
   |                                   |                        |--UPDATE appointments SET discount fields
   |                                   |                        |--INSERT service_discount_redemptions
   |                                   |                        |                         |
   |                                   |                        | [if coupon applied]     |
   |                                   |                        |--UPDATE appointments SET coupon fields
   |                                   |                        |--INSERT coupon_redemptions
   |                                   |                        |                         |
   |<--{ booking: { appointment_id } }--                        |                         |
   |  (201 Created)                    |                        |                         |
   |                                   |                        |                         |
   |--Show confirmation screen-------->|                        |                         |
```

### Files Involved
| Step | File | Function |
|---|---|---|
| 1. Booking UI | `src/components/booking/BookingFlow.tsx` | `BookingFlow()` |
| 2. Slot API | `src/app/api/slots/route.ts` | `GET()` |
| 3. Availability | `src/lib/booking/availability.ts` | `generateAvailableSlots()` |
| 4. Booking POST | `src/app/api/appointments/route.ts` | `POST()` |
| 5. Rate limiting | `src/lib/rate-limit.ts` | `rateLimit()` |
| 6. Validation | `src/lib/validators.ts` | `createAppointmentSchema` |
| 7. Duration | `src/lib/booking/availability.ts` | `getBookingDurationMinutes()` |
| 8. Discounts | `src/lib/service-discounts.ts` | `findServiceDiscount()` |
| 9. Coupons | `src/lib/coupons.ts` | `validateCoupon()` |
| 10. RPC | `supabase/migrations/008_blocked_time_ranges.sql:37` | `create_public_booking()` |

---

## 3. DASHBOARD LOAD FLOW

### User Story
A business owner navigates to their dashboard after login.

### Sequence Diagram

```
Browser                  layout.tsx              getOwnedBusiness()          Supabase                 Page Component
   |                         |                         |                         |                         |
   |--GET /dashboard-------->|                         |                         |                         |
   |                         |--createSupabaseServerClient()                     |                         |
   |                         |--supabase.auth.getUser()------------------------>|                         |
   |                         |<--{ user }-------------------------------------------                     |
   |                         |                         |                         |                         |
   |                         | [no user → redirect to /login]                   |                         |
   |                         |                         |                         |                         |
   |                         |--getOwnedBusiness(supabase)-->                   |                         |
   |                         |                         |--SELECT FROM businesses WHERE owner_id = user.id  |
   |                         |                         |<--{ business }----------|                         |
   |                         |<--{ business }----------|                         |                         |
   |                         |                         |                         |                         |
   |                         |--renders DashboardNav + children page component-->|                         |
   |                         |                         |                         |                         |
   |                         |                         |      e.g. /dashboard/appointments:                |
   |                         |                         |      SELECT appointments WHERE business_id = x    |
   |<--Full HTML response----|                         |                         |                         |
```

### Files Involved
| Step | File | Function |
|---|---|---|
| 1. Layout | `src/app/dashboard/layout.tsx` | `DashboardLayout()` |
| 2. Server client | `src/lib/supabase/server.ts` | `createSupabaseServerClient()` |
| 3. Business fetch | `src/lib/api.ts` | `getOwnedBusiness()` |
| 4. Nav render | `src/components/dashboard/DashboardNav.tsx` | `DashboardNav()` |

---

## 4. APPOINTMENT STATUS UPDATE FLOW

### User Story
A business owner changes an appointment's status (e.g. from `pending` to `confirmed`) from the Appointments Panel.

### Sequence Diagram

```
Browser (AppointmentsPanel)        PUT /api/appointments/[id]/status      PostgreSQL (appointments, audit_logs)
   |                                           |                                    |
   |--PUT /api/appointments/{id}/status------->|                                    |
   |  { status: "confirmed" }                  |                                    |
   |                                           |--requireUser()                     |
   |                                           |--requireOwnedBusiness()            |
   |                                           |--Zod parse { status }              |
   |                                           |                                    |
   |                                           |--UPDATE appointments               |
   |                                           |  SET status = "confirmed"          |
   |                                           |  WHERE id = ? AND business_id = ?->|
   |                                           |<--{ appointment }------------------|
   |                                           |                                    |
   |                                           |--INSERT audit_logs {               |
   |                                           |    event_type: "appointment_status_updated",
   |                                           |    message: "Status updated to confirmed for <name>"
   |                                           |  }------------------------------->|
   |                                           |                                    |
   |<--{ appointment }------------------       |                                    |
   |  (200 OK)                                 |                                    |
   |--UI re-renders with new status badge----->|                                    |
```

### Files Involved
| Step | File | Function |
|---|---|---|
| 1. UI action | `src/components/dashboard/AppointmentsPanel.tsx` | `updateStatus()` |
| 2. API handler | `src/app/api/appointments/[id]/status/route.ts` | `PUT()` |
| 3. Auth check | `src/lib/api.ts` | `requireUser()`, `requireOwnedBusiness()` |
| 4. DB update | `route.ts:22-29` | `supabase.from("appointments").update()` |
| 5. Audit log | `route.ts:31-36` | `supabase.from("audit_logs").insert()` |

---

## 5. PAYMENT FLOWS

### 5A. Stripe Checkout Payment

```
Browser                    /api/payments/stripe-checkout     Stripe API          /api/payments/stripe-webhook    PostgreSQL
   |                                   |                         |                          |                      |
   |--POST /api/payments/stripe-checkout                         |                          |                      |
   |  { appointmentId }                |                         |                          |                      |
   |                                   |--requireUser()          |                          |                      |
   |                                   |--fetch appointment------+------(admin client)------>                      |
   |                                   |--stripe.checkout.sessions.create({                 |                      |
   |                                   |    line_items: [price, name],                      |                      |
   |                                   |    metadata: { appointment_id, payment_id }        |                      |
   |                                   |  })--------------------->|                          |                      |
   |                                   |<--{ url: checkout_url }--|                          |                      |
   |<--{ url }-------------------------|                          |                          |                      |
   |--redirect to Stripe Checkout------>                          |                          |                      |
   |                                   |                          |                          |                      |
   |             [Client pays on Stripe]                          |                          |                      |
   |                                   |                          |--checkout.session.completed event               |
   |                                   |                          |------------------------->|                      |
   |                                   |                          |   POST /api/payments/stripe-webhook             |
   |                                   |                          |                          |                      |
   |                                   |                          |  verifyStripeSignature() |                      |
   |                                   |                          |  (HMAC-SHA256 timing-safe)|                     |
   |                                   |                          |                          |                      |
   |                                   |                          |  UPDATE payments SET status="confirmed"-------->|
   |                                   |                          |  UPDATE appointments SET status="confirmed"---->|
   |                                   |                          |  INSERT notifications {type:"payment_confirmed"}|
   |                                   |<-- { received: true }----|                          |                      |
```

### 5B. Manual Receipt Upload

```
Browser (BookingFlow)       /api/payments/upload-receipt         Supabase Storage          /api/payments/[id]/confirm
   |                                   |                              |                               |
   |--POST (FormData: file)----------->|                              |                               |
   |                                   |--supabase.storage.upload("payment-receipts", file)---------->|
   |                                   |<--{ publicUrl }-------------|                               |
   |                                   |--UPDATE payments SET receipt_image_url = url                |
   |<--{ receiptUrl }------------------|                              |                               |
   |                                   |                              |                               |
   |            [Owner reviews receipt]|                              |                               |
   |                                   |                              |                               |
   |--PUT /api/payments/{id}/confirm-->|                              |            PUT to confirm route
   |                                   |                              |               |               |
   |                                   |                              |--UPDATE payments SET status="confirmed"
   |                                   |                              |--UPDATE appointments SET status="confirmed"
   |                                   |                              |--INSERT audit_logs {event_type:"payment_confirmed"}
   |<--{ payment }---------------------|                              |                               |
```

### Files Involved
| Step | File | Function |
|---|---|---|
| 1. Checkout session | `src/app/api/payments/stripe-checkout/route.ts` | `POST()` |
| 2. Stripe provider | `src/services/payments/stripeCheckoutProvider.ts` | `createStripeCheckoutSession()` |
| 3. Webhook verify | `src/app/api/payments/stripe-webhook/route.ts` | `verifyStripeSignature()` |
| 4. Receipt upload | `src/app/api/payments/upload-receipt/route.ts` | `POST()` |
| 5. Manual confirm | `src/app/api/payments/[id]/confirm/route.ts` | `PUT()` |
| 6. Manual reject | `src/app/api/payments/[id]/reject/route.ts` | `PUT()` |

---

## 6. NOTIFICATIONS FLOW

### User Story
A new appointment is created; the business owner sees a notification badge on their dashboard.

### Sequence Diagram

```
Supabase PostgreSQL          TRIGGER              public.notifications       Dashboard (/api/notifications)   Browser
   |                            |                         |                            |                        |
   | INSERT INTO appointments -->|                         |                            |                        |
   |                            |--trigger_log_new_appointment fires                   |                        |
   |                            |  INSERT INTO audit_logs{ event_type, message }------>|                        |
   |                            |                         |                            |                        |
   |                            | [Stripe webhook]        |                            |                        |
   |                            |  INSERT INTO notifications {                         |                        |
   |                            |    type: "payment_confirmed",                        |                        |
   |                            |    title: "Online payment confirmed"                 |                        |
   |                            |  }----------------------------->|                   |                        |
   |                            |                         |       |                   |                        |
   |                            |                         |       |  Browser polling  |                        |
   |                            |                         |       |<--GET /api/notifications----               |
   |                            |                         |       |  requireUser()    |                        |
   |                            |                         |       |  SELECT FROM notifications                 |
   |                            |                         |       |  WHERE user_id = ? AND is_read = false      |
   |                            |                         |       |--{ notifications }------------------------>|
   |                            |                         |       |                   |  Update badge count   |
   |                            |                         |       |                   |  Show toast           |
```

### Files Involved
| Step | File | Function |
|---|---|---|
| 1. In-app service | `src/services/notifications/inAppNotificationService.ts` | `createInAppNotification()` |
| 2. Notification API | `src/app/api/notifications/[id]/read/route.ts` | `PUT()` |
| 3. Browser push | `src/services/notifications/browserNotificationHelper.ts` | `requestPermission()` |

---

## 7. TELEGRAM BOOKING FLOW

### User Story
A client sends a message to the business's Telegram bot and completes a booking entirely through the chat.

### Sequence Diagram

```
Telegram Client           Telegram API         POST /api/webhooks/telegram         bookingAutomation.ts         Supabase RPC
   |                          |                         |                                  |                          |
   |--sends "hi"------------->|                         |                                  |                          |
   |                          |--POST webhook payload-->|                                  |                          |
   |                          |                         |--validateTelegramSecret()        |                          |
   |                          |                         |--parseTelegramMessage()          |                          |
   |                          |                         |--fetch telegram_integrations     |                          |
   |                          |                         |--idempotency check (chat_messages)|                         |
   |                          |                         |--upsert chat_conversations       |                          |
   |                          |                         |--store incoming chat_messages    |                          |
   |                          |                         |                                  |                          |
   |                          |                         |--processMessage(supabase,        |                          |
   |                          |                         |   businessId, businessSlug,      |                          |
   |                          |                         |   chatId, name, state, text)---->|                          |
   |                          |                         |                                  |                          |
   |         FSM STATE MACHINE PROGRESSION:              |                                  |                          |
   |                          |                         |  step=idle → builds menu         |                          |
   |                          |                         |  step=awaiting_service → picks service                      |
   |                          |                         |  step=awaiting_option → picks option                        |
   |                          |                         |  step=awaiting_date → parseDate()                           |
   |                          |                         |  step=awaiting_time → generateAvailableSlots()              |
   |                          |                         |  step=awaiting_name → stores client_name                    |
   |                          |                         |  step=awaiting_confirm → [user sends "confirm"]             |
   |                          |                         |                                  |                          |
   |                          |                         |                                  |--createBooking()-------->|
   |                          |                         |                                  |  supabase.rpc(           |
   |                          |                         |                                  |  "create_public_booking",|
   |                          |                         |                                  |  { p_business_slug,      |
   |                          |                         |                                  |    p_service_id,         |
   |                          |                         |                                  |    p_client_phone (chatId)
   |                          |                         |                                  |  })                      |
   |                          |                         |                                  |                          |
   |                          |                         |                                  |  TRIGGER fires:          |
   |                          |                         |                                  |  INSERT audit_logs       |
   |                          |                         |                                  |<--{ appointment_id }-----|
   |                          |                         |<--{ reply: "✅ Confirmed!...",   |                          |
   |                          |                         |    newState: { step: "idle" } }--|                          |
   |                          |                         |                                  |                          |
   |                          |                         |--UPDATE chat_conversations SET state=newState              |
   |                          |                         |--INSERT chat_messages { sender:"system", body: reply }     |
   |                          |                         |--sendTelegramMessage(integration, chatId, reply)---------->|
   |<--"✅ Your appointment is confirmed!"               |                                  |                          |
```

### Files Involved
| Step | File | Function |
|---|---|---|
| 1. Webhook entry | `src/app/api/webhooks/telegram/route.ts` | `POST()` |
| 2. Message parse | `src/services/notifications/telegramService.ts` | `parseTelegramMessage()` |
| 3. Secret verify | `telegramService.ts` | `validateTelegramSecret()` |
| 4. State machine | `src/services/notifications/bookingAutomation.ts` | `processMessage()` |
| 5. Slot generation | `src/lib/booking/availability.ts` | `generateAvailableSlots()` |
| 6. Booking RPC | `bookingAutomation.ts:512` | `createBooking()` → `supabase.rpc("create_public_booking")` |
| 7. Reply delivery | `telegramService.ts` | `sendTelegramMessage()` |

---

## 8. APPOINTMENT CANCELLATION FLOW

### 8A. Owner-Side Cancellation

```
Browser (AppointmentsPanel)     DELETE /api/appointments/[id]       PostgreSQL (appointments)
   |                                         |                                 |
   |--DELETE /api/appointments/{id}--------->|                                 |
   |                                         |--requireUser()                  |
   |                                         |--requireOwnedBusiness()         |
   |                                         |                                 |
   |                                         |--UPDATE appointments            |
   |                                         |  SET status = "cancelled"       |
   |                                         |  WHERE id = ?                   |
   |                                         |  AND business_id = ?----------->|
   |                                         |<--{ success: true }-------------|
   |<--{ success: true }---------------------|                                 |
   |--Remove appointment from UI list------->|                                 |
```

### 8B. Telegram Cancellation (via Chat State Machine)

```
Telegram Client           /api/webhooks/telegram          bookingAutomation.ts          PostgreSQL
   |                               |                               |                         |
   |--sends "3" (cancel option)--->|                               |                         |
   |                               |--processMessage() ----------->|                         |
   |                               |                               |--handleCancelSelect()   |
   |                               |                               |--SELECT appointments    |
   |                               |                               |  WHERE client_phone = chatId
   |<--[lists upcoming bookings]---|                               |  AND status IN (pending, confirmed)
   |                               |                               |<------------------------|
   |--sends booking number-------->|                               |                         |
   |                               |--processMessage()------------>|                         |
   |                               |                               |--processCancelSelection()|
   |                               |                               |--UPDATE appointments    |
   |                               |                               |  SET status = "cancelled"|
   |                               |                               |------------------------>|
   |<--"✅ Appointment cancelled"--|                               |                         |
```

### Files Involved
| Step | File | Function |
|---|---|---|
| 1. Owner cancel | `src/app/api/appointments/[id]/route.ts` | `DELETE()` |
| 2. Telegram cancel | `src/services/notifications/bookingAutomation.ts` | `handleCancelSelect()`, `processCancelSelection()` |

---

## 9. RESCHEDULING FLOW

### User Story
A client requests a reschedule via Telegram chat.

### Sequence Diagram

```
Telegram Client           /api/webhooks/telegram          bookingAutomation.ts          PostgreSQL
   |                               |                               |                         |
   |--sends "4" (reschedule)------>|                               |                         |
   |                               |--processMessage()------------>|                         |
   |                               |                               |--handleRescheduleSelect()|
   |                               |                               |--SELECT appointments    |
   |                               |                               |  (upcoming for chatId)  |
   |<--[list of appointments]------|                               |<------------------------|
   |                               |                               |                         |
   |--picks appointment number---->|                               |                         |
   |                               |--step=awaiting_reschedule_date                          |
   |<--"What new date?"------------|                               |                         |
   |                               |                               |                         |
   |--sends date (e.g. tomorrow)-->|                               |                         |
   |                               |--parseDate()--->              |                         |
   |                               |--generateAvailableSlots()---->|                         |
   |                               |                               |--SELECT availability    |
   |                               |                               |--SELECT blocked_dates   |
   |                               |                               |--RPC get_booked_ranges  |
   |<--[list of new time slots]----|                               |<------------------------|
   |                               |                               |                         |
   |--picks new time slot # ------>|                               |                         |
   |                               |--step=awaiting_reschedule_time                          |
   |                               |--processRescheduleSelection()->|                         |
   |                               |                               |--UPDATE appointments    |
   |                               |                               |  SET appointment_date = newDate
   |                               |                               |  SET start_time = newTime
   |                               |                               |  SET status = "rescheduled"
   |                               |                               |------------------------>|
   |<--"✅ Rescheduled to..."------|                               |<------------------------|
```

### Files Involved
| Step | File | Function |
|---|---|---|
| 1. Reschedule select | `src/services/notifications/bookingAutomation.ts` | `handleRescheduleSelect()` |
| 2. Date parsing | `bookingAutomation.ts` | `parseDate()` |
| 3. Slot calc | `src/lib/booking/availability.ts` | `generateAvailableSlots()` |
| 4. Time selection | `bookingAutomation.ts` | `processRescheduleSelection()` |

---

## Cross-Subsystem Data Flow Summary

```
                       [Browser / Telegram]
                               │
               ┌───────────────┼───────────────┐
               ▼               ▼               ▼
         /book/*          /dashboard       /api/webhooks/telegram
               │               │               │
               └───────┬───────┘               │
                       ▼                       │
              /api/appointments ───────────────┘
               │       │
               │       ▼
               │   create_public_booking RPC
               │       │
               │       ├── INSERT appointments
               │       ├── TRIGGER → audit_logs
               │       └── RETURN appointment_id
               │
               ├── /api/payments/stripe-checkout
               │       │
               │       └── Stripe API → stripe-webhook
               │                           │
               │                       UPDATE payments
               │                       UPDATE appointments
               │                       INSERT notifications
               │
               └── /api/appointments/[id]/status
                       │
                   UPDATE appointments
                   INSERT audit_logs
```
