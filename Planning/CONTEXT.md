# Planning Context — HealthHub PMS

## What Is HealthHub PMS

HealthHub PMS is a multi-tenant dental clinic management SaaS. It started as a single-clinic deployment (DentalisPMS for DDCJ — Dentalis Dental Care by Jamians) and is now being rebuilt as a cloud SaaS that multiple clinics can subscribe to and use independently. It handles the full clinic workflow: public patient booking, admin appointment management, prescriptions, payments, printable documents, and doctor profiles.

## Tech Stack

- **Framework:** Next.js 16 (App Router) + TypeScript (strict)
- **Target:** Web SaaS — multi-tenant, subdomain-per-clinic routing
- **Database:** Supabase PostgreSQL via Prisma ORM v7 (`@prisma/adapter-pg`)
- **Auth:** Supabase Auth — email/password for admins; OTP (phone) for patient portal (Phase 6)
- **Styling:** Tailwind CSS v4
- **Validation:** Zod v4 — shared schemas for client and server
- **Date/Time:** Luxon — all timezone operations use `clinic.timezone` from DB
- **CSV Export:** json2csv
- **Deployment:** Vercel (app) + Supabase (database + auth)
- **Rate Limiting:** Upstash Redis (serverless-compatible)

## Current Priorities

1. Phase 2 multi-tenancy — complete (clinicId on all tables, middleware injection, subdomain routing)
2. Phase 3 clinic onboarding — complete (/register wizard, check-slug + register APIs)
3. Phase 4 — Razorpay billing subscriptions
4. Phase 5 — Per-clinic settings page (name, address, logo, business hours, custom domain)
5. Phase 6 — Patient portal (OTP login, appointment/prescription/receipt view)

## Architectural Principles

- **Strict tenant isolation:** Every Prisma query filters by `clinicId`. Never return cross-clinic data. This is the most critical invariant.
- **Subdomain-first routing:** `{slug}.dentalispms.com` → middleware reads host → looks up `Clinic` by slug → injects `clinicId` into request context.
- **HealthHub is invisible to patients:** Patients only ever see the clinic's brand at `{slug}.dentalispms.com`. The root domain is for clinic owners. No patient-facing directory or marketplace. Clinics bring their own patients via the booking link.
- **App-layer isolation now, RLS later:** Data isolation enforced via `WHERE clinicId = ?` at the app layer. Supabase RLS is a future hardening step (before 20 clinics).
- **Timezone from DB:** All timezone-sensitive operations use `clinic.timezone` from the Clinic DB row via Luxon. Never hardcode `Asia/Kolkata` in new code.
- **Two-stage patient entry:** Public booking form collects minimal fields (name, phone, preferred time). Admin completes the record on arrival. Several Patient fields are nullable by design.

## MVP Features (Phase 1 — Complete)

1. **Public booking form** — Minimal fields, rate-limited, duplicate detection
2. **Appointment management** — Admin CRUD, status transitions, bulk actions
3. **Patient records** — Lookup, full profile, appointment history
4. **Prescriptions** — Create, view, printable output
5. **Payments** — Record payments, open bills, payment reports
6. **Printable templates** — Custom document templates per clinic
7. **Doctor profiles** — Manage doctors, assign to appointments
8. **CSV export** — Appointment and payment data
9. **Admin auth** — Supabase email/password, protected dashboard

## Roadmap

### Phase 1 — Single-clinic MVP (DONE)
Appointments, patients, prescriptions, payments, printable templates, doctor profiles, CSV export, public booking form.

### Phase 2 — Multi-tenancy Foundation (DONE)
- `Clinic` model with slug, shortName, timezone, address, logo, isActive
- `clinicId` FK on all tables: patients, appointments, doctors, payments, prescriptions, printable_templates, admins
- Subdomain routing: middleware reads host → looks up Clinic by slug → injects clinicId
- All 25+ routes and API handlers scoped to clinicId
- DDCJ config migrated from static file into DB row

### Phase 3 — Clinic Onboarding (DONE)
- `/register` wizard: name → slug → address → logo → admin credentials
- `/api/onboarding/check-slug` — slug availability check
- `/api/onboarding/register` — creates Clinic + Supabase auth user + Admin in one saga with compensation
- Supabase Storage for logo uploads

### Phase 4 — Billing (PLANNED)
- Razorpay Subscriptions (India-native)
- Middleware gates dashboard access on `clinic.subscriptionStatus`
- Webhook handler for charge/cancel events
- Billing portal page

### Phase 5 — Per-Clinic Customisation (PLANNED)
- Settings page: edit clinic name, address, phones, logo, business hours
- Custom domain support: clinic adds CNAME → app calls Vercel API → domain goes live
  - `customDomain` + `domainVerified` fields on `Clinic` model
  - Middleware resolves tenant by custom domain if not a `*.dentalispms.com` subdomain
  - Admin settings UI shows CNAME instruction and verification status

### Phase 6 — Patient Portal (PLANNED)
- OTP login via Supabase Auth (phone number)
- Patients view their own appointments, prescriptions, payment receipts
- Scoped to phone + clinicId

## User Flow

```
URL map:
  dentalispms.com            → clinic OWNERS: landing page (/), /register, /login ("find your clinic"), /platform
  {slug}.dentalispms.com     → that clinic's PATIENTS + STAFF: public clinic page + booking form (/), /admin/*
  (Pre-launch, no domain: *.workers.dev serves DEFAULT_CLINIC_SLUG only — one clinic at a time.)

Public Patient:
  Reaches the clinic's link (Google Business Profile, WhatsApp, reception QR, Instagram, clinic website)
  → Visits {slug}.dentalispms.com
  → Fills booking form (name, phone, preferred date/time)
  → Duplicate check + rate limit
  → Appointment created (status: pending)
  → Arrives at clinic → admin completes record

Admin:
  Logs in at {slug}.dentalispms.com/admin/login
  → Dashboard: today's appointments, stats
  → Manage appointments (confirm, complete, cancel)
  → Complete patient records on arrival
  → Issue prescriptions, record payments
  → Generate printable documents
  → View reports + export CSV

Clinic Owner (Onboarding):
  Visits dentalispms.com (landing page) → "Register your clinic"
  → dentalispms.com/register setup wizard: name → slug → address → logo → admin credentials
  → Clinic + Admin created in one transaction
  → Success screen leads with the patient booking link ({slug}.dentalispms.com): copy, share on WhatsApp, download QR
  → Then: go to {slug}.dentalispms.com/admin/login
```

_Planned, not built: landing page at root (today `/` redirects to `/register`); booking-link share step on the success screen (today it only links to admin login); clinic page around the booking form (address, hours, phone, map); remove "Login as Admin" link and dental-specific copy from the patient page._

## Architecture Decisions

### 2025 — Infrastructure Split
**Decision:** New SaaS Supabase project (`apuxomkxwtjcoaqjhlux`, ap-northeast-2), separate GitHub repo, separate Vercel project. Fully isolated from original DDCJ clinic deployment.
**Rationale:** The live clinic must not be affected by SaaS development. Zero shared infrastructure.

### 2025 — Prisma ORM with @prisma/adapter-pg
**Decision:** Use Prisma v7 with the `@prisma/adapter-pg` driver adapter, not the legacy `DATABASE_URL`-only approach.
**Rationale:** Required for Supabase Supavisor connection pooling (serverless-safe). Two connection strings: transaction pooler (port 6543) for queries, session pooler (port 5432) for migrations.

### 2025 — App-layer tenant isolation before RLS
**Decision:** Enforce `clinicId` filtering in every Prisma query now. Add Supabase RLS before reaching 20 clinics.
**Rationale:** RLS adds complexity and migration risk at the start. App-layer is sufficient and auditable for early tenants.

### 2025 — Razorpay for billing (Phase 4)
**Decision:** Use Razorpay Subscriptions over Stripe.
**Rationale:** India-native payment rails, lower fees, better UPI support for the target market.

### 2026 — Custom Domain Support (Phase 5, planned)
**Decision:** Clinic enters custom domain → app calls Vercel API to register → middleware resolves tenant by `customDomain` if not a `*.dentalispms.com` host.
**Rationale:** Larger clinics want their own branded URL. Vercel handles SSL automatically. Requires `VERCEL_TOKEN` + `VERCEL_PROJECT_ID` env vars.

### 2026-09-27 — Clinic-scoped IDs + advisory-lock RPCs (Cloudflare rollout Batch 1)
**Decision:** `patientId` / `prescriptionId` are unique per clinic (`@@unique([clinicId, …])`), matching `appointmentId`. ID generation and slot-conflict checks run in Postgres RPCs serialized by `pg_advisory_xact_lock(hashtext(clinicId))`, using `MAX(serial)+1`.
**Rationale:** Global uniqueness on per-clinic-generated IDs made two clinics' first prescription of a day collide; `COUNT+1` re-issued IDs after deletes. Both were masked by Prisma retry loops. A per-clinic lock prevents the race instead of retrying it, and different clinics never block each other. Required anyway to move off Prisma for Cloudflare Workers.

### 2026-10-06 — Patient-invisible platform; root domain is a landing page; domain bought at launch
**Decision:** (1) HealthHub is a tool for clinics, invisible to patients — no marketplace or cross-clinic search. (2) Clinics are addressed by subdomain (`{slug}.dentalispms.com`) once a domain is added; no path-based (`/c/{slug}`) fallback. (3) The domain is bought at launch, after the flows are fixed — until then, testing runs on `*.workers.dev` with `DEFAULT_CLINIC_SLUG` selecting the one clinic served.
**Rationale:** Selling software to clinics doesn't depend on attracting patients ourselves; a marketplace would compete with Practo. Subdomains look professional and Cloudflare's wildcard DNS/cert is free. Accepted trade-off: before launch, only one clinic's public booking page is reachable at a time (admin dashboards work for every clinic on any host).

### 2026-09-27 — Uniqueness on FK columns declared as constraints
**Decision:** 1:1 FK columns get a unique *constraint* (not just Prisma's unique index).
**Rationale:** PostgREST and `supabase gen types` infer one-to-one only from constraints; otherwise embeds return arrays. SQL/Postgres standard practice; Prisma introspects both as `@unique`, so no schema drift.
