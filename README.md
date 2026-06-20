# BookNest

[![CI Status](https://github.com/<your-username>/<your-repo-name>/actions/workflows/ci.yml/badge.svg)](https://github.com/<your-username>/<your-repo-name>/actions/workflows/ci.yml)

BookNest is a Supabase-powered booking and appointment management MVP for service businesses. Version 1 focuses on a working owner dashboard, public booking page, iframe embed, manual bank-transfer payment confirmation, receipt uploads, in-app notifications, reminder dashboards, and manual WhatsApp/email message helpers.

No paid third-party APIs are required for the MVP.

---

## 👥 Collaborative Open-Source Project Assignment

This repository is configured for your collaborative project.
* For guidelines on how to contribute, set up branching, submit PRs, and review changes, see the **[Contributing Guide](file:///c:/Users/Adetola/Desktop/Acuity/CONTRIBUTING.md)**.
* For a list of starter tasks (coding and non-coding) that you can copy and paste into GitHub issues, see the **[Starter Issues List](file:///c:/Users/Adetola/Desktop/Acuity/good-first-issues.md)**.

---

## Stack

- Next.js App Router
- React
- Tailwind CSS
- Supabase Auth, PostgreSQL, Storage, RLS, and optional Realtime later

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local` from `.env.example`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

3. In Supabase, run the migrations in order:

```text
supabase/migrations/001_initial_booknest_schema.sql
supabase/migrations/002_repair_attach_public_receipt.sql
```

This creates tables, RLS policies, storage buckets, auth profile trigger, storage policies, and booking RPC functions.

4. In Supabase Auth settings, enable email confirmations and configure redirect URLs:

```text
http://localhost:3000/login
http://localhost:3000/reset-password
```

5. Start the app:

```bash
npm run dev
```

6. Open:

```text
http://localhost:3000
```

## Seed Hair/Beauty Catalog

After creating and confirming a Supabase Auth owner, run `supabase/seed.sql` in the Supabase SQL Editor. It attaches the seed data to the newest Supabase Auth user in the project.

It creates a `Blissart` business with slug `blissart`, availability, and the hair/beauty catalog from the brief:

- Human Hair Boho Braids with Bob, Butt, and Thigh Length options plus Curly Ends add-on
- Human Hair Boho Locs + Retwist
- Kids Styles
- Knotless + French Curl with Small, Smedium, Medium, Jumbo options
- Loc Services
- Men's Natural Hair Styles / Cornrows
- Take Down / Removal Services
- Touch Up Services
- Tribal / Fulani + Stitch Braids
- Twists
- Weave Styles

## Main Routes

- `/signup`
- `/login`
- `/forgot-password`
- `/reset-password`
- `/logout`
- `/dashboard`
- `/dashboard/appointments`
- `/dashboard/services`
- `/dashboard/service-categories`
- `/dashboard/service-options`
- `/dashboard/add-ons`
- `/dashboard/availability`
- `/dashboard/clients`
- `/dashboard/payments`
- `/dashboard/settings`
- `/dashboard/embed-code`
- `/dashboard/notifications`
- `/dashboard/calendar`
- `/dashboard/reminders`
- `/book/[businessSlug]`
- `/embed/[businessSlug]`

## API Routes

The MVP includes route handlers for business settings, public business catalog, service categories, services, service options, service add-ons, availability, blocked dates, slots, appointments, payments, notifications, reminders, dashboard summaries, clients, and dashboard catalog data.

Booking creation goes through the `create_public_booking` Supabase RPC. That function validates service availability, blocked dates, working hours, past dates, add-ons, service duration, buffers, and double-booking with:

```text
newStart < existingEnd AND newEnd > existingStart
```

It also uses a transaction advisory lock per business/date to reduce race conditions when two clients book at the same time.

## Storage

The migration creates:

- `business-logos`: public logo uploads, 2 MB max
- `payment-receipts`: public receipt uploads, 5 MB max

The MVP stores public receipt URLs for easy manual review. See `supabase/storage-setup.md` for notes on switching receipts to signed URLs later.

## MVP Notification Strategy

Supabase Auth emails are used only for account flows:

- Signup confirmation
- Password reset

Appointment reminders and notifications use:

- In-app dashboard notifications
- Client confirmation page
- Printable/copyable/downloadable booking details
- Manual WhatsApp links
- Copyable email/message templates
- Optional browser notifications while the dashboard is open

## Future Integration Placeholders

Optional paid/API integrations are prepared but not implemented:

- `src/services/notifications/futureEmailProvider.ts`
- `src/services/notifications/futureSmsProvider.ts`
- `src/services/notifications/futureWhatsAppProvider.ts`
- `src/services/payments/futurePaystackProvider.ts`
- `src/services/payments/futureStripeProvider.ts`
- `src/services/calendar/futureGoogleCalendarProvider.ts`
- `src/services/staff/futureStaffScheduling.ts`
- `src/services/widget/futureJavascriptWidget.ts`
- `src/services/packages/futurePackagesMemberships.ts`
- `src/services/coupons/futureCouponsProvider.ts`
- `src/services/reviews/futureReviewsProvider.ts`
- `src/services/reminders/futureSupabaseEdgeFunctionReminders.ts`

These files intentionally do not import provider SDKs or require API keys.

## Iframe Example

Local:

```html
<iframe
  src="http://localhost:3000/embed/blissart"
  width="100%"
  height="800"
  style="border: none; border-radius: 12px;"
></iframe>
```

Production:

```html
<iframe
  src="https://yourdomain.com/embed/blissart"
  width="100%"
  height="800"
  style="border: none; border-radius: 12px;"
></iframe>
```

## Security Notes

- Dashboard routes require a Supabase session.
- RLS limits owners to their business data.
- Public booking reads only active booking catalog data.
- Appointment creation is handled by a database RPC rather than direct client inserts.
- Receipt/logo upload types and sizes are validated in the client and Storage bucket config.
- Keep the anon key public; never add service-role keys to browser code.
