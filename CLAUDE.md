# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**HealthHub PMS** is a multi-tenant dental clinic management SaaS. It evolved from a single-clinic deployment (DentalisPMS for DDCJ — Dentalis Dental Care by Jamians) and is now being rebuilt as a cloud SaaS that multiple clinics can subscribe to and use independently.

**This repository is the SaaS product codebase.** It is fully isolated from the original single-clinic deployment. Do not reference, connect to, or affect the original clinic's infrastructure in any way.

### Infrastructure Split

| | SaaS product (this repo) | Original clinic (hands-off) |
|---|---|---|
| GitHub | `dentalis-clinic/healhubPMS` | `dentalis-clinic/pms` |
| Supabase | `apuxomkxwtjcoaqjhlux` (ap-northeast-2) | `erezwhfjexvnvxqaihae` (ap-southeast-1) |
| Hosting | Cloudflare Workers `dentalis-pms` via OpenNext (not yet deployed) | Vercel `prj_iFvzmznya185EqJeL99DZhtTBLsE` |

**Privacy commitment:** We never sell or share patient data. Data isolation between tenants is enforced at the application layer (`clinicId` filtering), with Supabase RLS as a future hardening step.

### Active work: Cloudflare migration (branch `cloudflare-migration`)

The app is being moved from Vercel to Cloudflare Workers, and the data layer from Prisma to `@supabase/supabase-js` + Postgres RPCs, in this order because the two are entangled (see `Planning/CLOUDFLARE_MIGRATION_PROGRESS.md` for why). **This work lives entirely on the `cloudflare-migration` git branch — not on `main`.** If you're reading this file from a `main` checkout, none of it applies yet; check out `cloudflare-migration` first (`git log main...cloudflare-migration` shows what's ahead).

- **Status + exact resume point:** `Planning/CLOUDFLARE_MIGRATION_PROGRESS.md` (status table + "Batch 2 log")
- **Coding conventions for converted routes** (id/updatedAt generation, RPC error mapping, timestamp serialization, etc.): `src/CONTEXT.md` → "Patterns to Follow"
- Every live-DB migration in this effort was dry-run in `BEGIN…ROLLBACK` and applied only with explicit user approval — keep doing that.

## SaaS Roadmap

### Phase 1 — Single-clinic MVP (DONE)
Appointments, patients, prescriptions, payments, printable templates, doctor profiles, CSV export, public booking form. Fully functional for one clinic.

### Phase 2 — Multi-tenancy Foundation (ACTIVE)
The prerequisite for everything SaaS. Nothing else starts until this is complete.
- Add `Clinic` model: `slug`, `name`, `shortName` (patient ID prefix), `timezone`, `address`, `phones`, `email`, `logo`, `isActive`
- Add `clinicId` FK to every table: `patients`, `appointments`, `doctors`, `payments`, `prescriptions`, `printable_templates`, `admins`
- Migrate DDCJ config from `src/lib/config/clinic.ts` (static file) into a `Clinic` DB row
- Subdomain routing: `ddcj.healthhub.app`, `newclinic.healthhub.app` → Cloudflare wildcard route `*.healthhub.app`
- Middleware reads subdomain → looks up `Clinic` by slug → injects `clinicId` into all request contexts
- Replace all hardcoded `Asia/Kolkata` (25+ files) with `clinic.timezone` from DB
- Replace hardcoded `DDCJ` prefix with `clinic.shortName` from DB
- All data queries (supabase-js `.eq("clinicId", …)` or RPC `p_clinic_id`) filter by `clinicId` — never return cross-clinic data
- Data isolation: app-layer filtering now; Supabase RLS is a future hardening step

### Phase 3 — Clinic Onboarding
- Public signup at root domain (not a clinic subdomain)
- Setup wizard: name → slug → address → logo → admin credentials
- Creates `Clinic` + Supabase auth user + `Admin` record in one transaction
- Welcome email with dashboard link

### Phase 4 — Billing
- Razorpay Subscriptions (India-native)
- Middleware gates dashboard access on `clinic.subscriptionStatus`
- Webhook handler for charge/cancel events
- Billing portal page

### Phase 5 — Per-Clinic Customisation
- Settings page: edit clinic name, address, phones, logo, business hours
- All stored in `Clinic` DB row — no more config files

### Phase 6 — Patient Portal
- OTP login via Supabase Auth (phone number)
- Patients view their own appointments, prescriptions, payment receipts
- Scoped to their phone + clinic

## Tech Stack

- **Framework:** Next.js 16 with App Router
- **Language:** TypeScript (strict)
- **Database:** Supabase PostgreSQL — app data via `@supabase/supabase-js` (typed); Prisma CLI for schema + migrations only
- **Auth:** Supabase Auth (`@supabase/supabase-js` + `@supabase/ssr`) — email/password for admin. Future: OTP for patient portal.
- **Styling:** Tailwind CSS v4
- **Validation:** Zod v4 (shared schemas for client + server)
- **Date/Time:** Luxon — all timezone operations must use `clinic.timezone` from DB (currently `Asia/Kolkata` while Phase 2 is pending)
- **CSV Export:** json2csv library
- **Deployment:** Cloudflare Workers via OpenNext (app) + Supabase (database + auth + storage)
- **Rate Limiting:** Upstash Redis (in-memory fallback in dev)

## Token Efficiency
- Never re-read files you just wrote or edited. You know the contents.
- Never re-run commands to "verify" unless the outcome was uncertain.
- Don't echo back large blocks of code or file contents unless asked.
- Batch related edits into single operations. Don't make 5 edits when 1 handles it.
- Skip confirmations like "I'll continue..." Just do it.
- If a task needs 1 tool call, don't use 3. Plan before acting.
- Do not summarize what you just did unless the result is ambiguous or you need additional input.

## Coding
- Always use TypeScript
- Never use "any"
- Use Luxon for all date/time operations — use `clinic.timezone` (Phase 2+) or `'Asia/Kolkata'` (Phase 1 compatibility)

## Database
- App data access is `@supabase/supabase-js` with the service-role client from `src/lib/supabase/admin.ts`, typed against `src/generated/supabase/database.types.ts` (regenerate with `npm run db:types` after every migration)
- Multi-step writes (anything transactional) go in Postgres RPC functions defined in `prisma/migrations/`, not in app code
- Prisma is the schema and migration tool only (`prisma/schema.prisma`, `prisma migrate deploy`); there is no Prisma client in the app
- Connection: `DIRECT_URL` (session pooler, port 5432) is used by the Prisma CLI and `db:types`
- Supabase PostgreSQL with connection pooling (Supavisor)
- Model names should always be plural, lowercase and snake_case. Never use CamelCase.
- **Known schema drift:** The migration history has gaps — some columns and tables (`appointmentId`, `doctorId`, `doctors`, `printable_templates`, `patients.age`, `patients.address`) were added to the original DB via `db push` without migrations. The new SaaS DB was synced via `prisma migrate deploy` + `prisma db push`. When Phase 2 migrations are written, generate them cleanly from the current `schema.prisma` state.

## Auth (Supabase)
- Supabase Auth handles user creation, login, sessions, and password management
- `Admin.id` in Prisma matches Supabase `auth.users.id` (shared UUID)
- Auth check pattern: authenticate via Supabase → check user exists in `admins` table → authorize
- Server-side: use `createClient` from `@supabase/ssr` for cookie-based sessions
- Client-side: use `createBrowserClient` from `@supabase/ssr`
- Middleware: refresh session cookies on every request to `/admin/*`
- Seed admin via `scripts/seed-admin.ts` (uses Supabase Admin API with service role key)
- Super admin ("platform admin"): separate `platform_admins` table, `/platform` panel, `/api/platform/*` guarded by `requirePlatformAdmin()`. These routes are the only code allowed to act across clinics — they never read `x-clinic-id`, and they never return patient data. Accounts come only from `scripts/seed-platform-admin.ts`.
- `requireAdmin()` returns 403 for admins of a deactivated clinic (`clinics.isActive = false`)

## Environment Variables
- Server vars: no prefix required
- Client vars: must use `NEXT_PUBLIC_` prefix (Next.js convention)
- Validated at startup via Zod schemas in `src/env.ts`
- Import as `import { env } from "@/env"`
- Both `.env` (used by the Prisma CLI, `db:types` and scripts via dotenv) and `.env.local` (used by Next.js) must be kept in sync — both point to the SaaS Supabase project (`apuxomkxwtjcoaqjhlux`)

## Commands

```bash
npm run dev          # Start dev server (http://localhost:3000)
npm run build        # Production build
npm run start        # Start production server
npm run lint         # ESLint
npx tsc --noEmit     # Type-check without emitting

# Database
npx prisma migrate dev --name <name>   # Create and apply migration
npx prisma db push                      # Push schema to DB (prototyping only — avoid drift)
npm run db:types                        # Regenerate Supabase DB types (after migrations)
npx prisma studio                       # Visual DB browser

# Seed
npx tsx scripts/seed-admin.ts           # Create initial admin user (requires SUPABASE_SERVICE_ROLE_KEY)
```

## Architecture

### Two-Stage Data Entry

Public form collects **minimal fields** (Name, Phone, Preferred Date/Time). When the patient arrives at the clinic, the admin **completes the record** with remaining data (DOB/age, Email, Reason for Visit). Several fields in the Patient model are nullable for this reason.

### Route Structure (App Router)

```
app/
  page.tsx                          — Public patient booking form (no auth, minimal fields)
  admin/
    login/page.tsx                  — Admin login (Supabase Auth)
    dashboard/                      — Protected: appointments, patients, reports, settings
  api/
    appointments/                   — CRUD for appointments (public POST + admin PATCH/GET)
    patients/                       — Patient lookup and management
    payments/                       — Payment recording and open bills
    prescriptions/                  — Prescription creation and retrieval
    printable-templates/            — Custom document template management
    doctors/                        — Doctor profile management
    admin/                          — Admin user management
    reports/                        — Payment and appointment reports
    auth/callback/route.ts          — Supabase auth callback
middleware.ts                        — Supabase session refresh + protect /admin/* routes
```

### Patient ID Generation

Format: `{CLINIC_PREFIX}-YYYYMMDD-XXXX` where prefix comes from `clinic.shortName` (e.g. `DDCJ`), date is in clinic's local timezone, and XXXX is a zero-padded daily serial.

- Generated inside the `find_or_create_patient` / `create_appointment_atomic` / `create_prescription_with_id` RPCs, under a per-clinic advisory lock (`pg_advisory_xact_lock`), using `MAX(serial)+1`
- Timezone is passed in from `clinic.timezone`; IDs are unique per clinic, not globally

### Phone Number Normalization

Strip non-digits → if 12 digits starting with `91`, drop the `91` → validate exactly 10 digits starting with 6-9 → reject all-same-digit patterns. Normalization happens server-side before storage. Currently India-only; will remain India-only for the foreseeable future.

## Multi-Tenancy Design Notes (for Phase 2)

- **Tenant resolution:** subdomain → `Clinic.slug` lookup in middleware → `clinicId` injected into request headers
- **Data isolation strategy:** app-layer `clinicId` filtering on every query and RPC. Supabase RLS is a future hardening step (before 20 clinics).
- **Patient ID prefix:** `clinic.shortName` replaces the hardcoded `DDCJ` constant in `src/lib/utils/patient-id.ts`
- **Timezone:** `clinic.timezone` replaces all hardcoded `'Asia/Kolkata'` strings. The constant `IST_ZONE` in `src/lib/utils/date.ts` should become a clinic config lookup.
- **Clinic config file:** `src/lib/config/clinic.ts` is Phase 1 only — delete it in Phase 2 when config moves to DB.

## Critical Business Rules

- **Timezone:** Always use clinic's configured timezone via Luxon. During Phase 1 compatibility period, use `'Asia/Kolkata'`. Never use raw `new Date()` for timezone-sensitive calculations.
- **Appointment window:** `preferredDateTime` must be after now and within 72 hours (server-enforced).
- **Rate limiting:** 3 submissions per IP per hour on the public endpoint.
- **Duplicate detection:** Same phone + name within 5 minutes → reject as duplicate.
- **CSV export:** Always use json2csv (handles commas/quotes in data correctly).
- **Cross-clinic data:** Never return data from one clinic to a request scoped to another clinic. This is the most important invariant in the SaaS system.

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL        — Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY   — Supabase publishable/anon key (safe for client-side)
SUPABASE_SERVICE_ROLE_KEY       — Supabase secret/service role key (server-only)
DIRECT_URL                      — Session pooler (port 5432) for Prisma CLI migrations and db:types
TZ                              — Asia/Kolkata
RATE_LIMIT_MAX                  — Max submissions per window (default 3)
RATE_LIMIT_WINDOW_MS            — Rate limit window in ms (default 3600000)
UPSTASH_REDIS_URL               — (optional) Upstash Redis for rate limiting
UPSTASH_REDIS_TOKEN             — (optional) Upstash Redis token
```

> Both `.env` and `.env.local` must point to the SaaS Supabase project. `.env` is loaded by the Prisma CLI (via `prisma.config.ts` → `dotenv/config`) and the scripts. `.env.local` is loaded by Next.js. Keep them in sync.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
