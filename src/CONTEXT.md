# Codebase Context — HealthHub PMS

## Code Structure

```
src/
├── app/
│   ├── page.tsx                          — Public patient booking form
│   ├── register/                         — Clinic onboarding wizard (Phase 3)
│   ├── admin/
│   │   ├── login/                        — Admin login (Supabase Auth)
│   │   └── dashboard/
│   │       ├── layout.tsx
│   │       ├── (main)/                   — Route group: sidebar layout
│   │       │   ├── home/                 — Dashboard stats
│   │       │   ├── appointments/         — Appointment management
│   │       │   ├── patients/             — Patient records
│   │       │   ├── history/              — Appointment history
│   │       │   ├── reports/              — Payment reports
│   │       │   └── settings/            — Clinic settings
│   │       └── prescription/
│   │           ├── [id]/                 — View prescription
│   │           ├── blank/[appointmentId] — New blank prescription
│   │           ├── blank-template/       — Blank template
│   │           └── template/[templateId] — Template-based prescription
│   └── api/
│       ├── appointments/                 — CRUD + bulk actions + availability
│       ├── patients/                     — Lookup + management
│       ├── payments/                     — Record + open bills
│       ├── prescriptions/               — Create + retrieve
│       ├── printable-templates/         — Custom template management
│       ├── doctors/                      — Doctor profiles
│       ├── clinic/                       — Clinic settings + logo upload
│       ├── dashboard/stats/             — Dashboard stat aggregation
│       ├── reports/payments/            — Payment report + CSV export
│       ├── admin/                        — Admin user management
│       ├── onboarding/                   — check-slug + register
│       ├── phone-check/                 — Phone availability check
│       └── auth/callback/               — Supabase auth callback
├── components/                          — Shared UI components
├── lib/
│   ├── auth/                            — Supabase auth helpers
│   ├── config/                          — Clinic config (Phase 1 only — delete in Phase 2 cleanup)
│   ├── constants/                       — App-wide constants
│   ├── data/                            — Data-fetching helpers
│   ├── supabase/                        — Client factories (server/browser/admin) + rpc.ts (typed RPC payloads, error mapping) + serialize.ts (timestamp normalization)
│   ├── utils/                           — date.ts, patient-id.ts, phone.ts, etc.
│   └── validations/                     — Zod schemas (shared client + server)
├── types/                               — TypeScript type definitions
├── env.ts                               — Zod-validated env vars (import as @/env)
├── generated/prisma/                    — Prisma generated client (do not edit; gitignored, rebuilt on postinstall)
└── generated/supabase/                  — Supabase DB types (do not edit; COMMITTED — regenerate with `npm run db:types` after every migration)
```

## Naming Conventions

- **Files:** kebab-case (`patient-id.ts`, `open-bills/route.ts`)
- **Components:** PascalCase (`AppointmentCard.tsx`, `PatientForm.tsx`)
- **Hooks:** camelCase with `use` prefix (`useAppointments`, `useClinicConfig`)
- **Types/Interfaces:** PascalCase (`Patient`, `AppointmentWithRelations`)
- **Prisma models:** plural, lowercase, snake_case (`patients`, `appointments`, `printable_templates`)
- **Variables/Functions:** camelCase
- **Constants:** SCREAMING_SNAKE_CASE (`IST_ZONE`, `RATE_LIMIT_MAX`)
- **Zod schemas:** camelCase with `Schema` suffix (`createAppointmentSchema`)

## Patterns to Follow

- **Data access (Cloudflare migration, in progress):** New/converted code uses `createAdminClient()` (supabase-js, typed with the generated `Database`) — not Prisma. Prisma stays the schema + migration tool. Multi-statement/transactional logic goes in a Postgres RPC function (migration file), not app code. See `Planning/CLOUDFLARE_MIGRATION_PROGRESS.md`.
- **Tenant scoping:** Every query (Prisma, supabase-js `.eq("clinicId", …)`, or inside an RPC `WHERE "clinicId" = p_clinic_id`) that touches patient/appointment/payment/prescription/doctor/template data MUST include `WHERE clinicId = {clinicId}`. Read `clinicId` from the request header injected by middleware — never trust client-supplied clinicId.
- **Env vars:** Always import from `@/env` (Zod-validated). Never access `process.env` directly.
- **Date/time:** Use Luxon for all timezone-sensitive operations. Use `clinic.timezone` from DB (Phase 2+). `'Asia/Kolkata'` only for Phase 1 compatibility shims.
- **Validation:** Define Zod schemas in `src/lib/validations/`. Use the same schema on both client and server.
- **Auth flow:** Supabase session check → verify `admins` table entry → authorize. Never skip the `admins` table check.
- **Patient/appointment/prescription ID generation:** Via the `find_or_create_patient` / `create_appointment_atomic` / `create_prescription_with_id` RPCs — per-clinic `pg_advisory_xact_lock` + `MAX(serial)+1`. IDs are unique per clinic (`@@unique([clinicId, …])`), not globally. Confirming an existing appointment uses `confirm_appointment` (patient patch + slot check + confirm, all-or-nothing).
- **Timestamps out of supabase-js:** PostgREST returns `timestamp` columns WITHOUT a zone (`"…T10:00:00"`), which JS parses as local time. Always pass through `utcIso` / `withUtcTimestamps` / `dateOnlyIso` (`@/lib/supabase/serialize`) before returning from a route.
- **Timestamps into RPCs:** Send ISO strings (`date.toISOString()`); SQL casts via `::timestamptz AT TIME ZONE 'UTC'`, never bare `::timestamp` (silently drops offsets).
- **`updatedAt` on plain `.update()`:** Prisma's `@updatedAt` was set client-side — the column has no DB default or trigger. Every supabase-js `.update()` must include `updatedAt: new Date().toISOString()` or it silently stops changing. (RPCs set it themselves.)
- **`id` and `updatedAt` on every table:** neither has a DB default (confirmed across all 9 tables) — every `.insert()` needs `id: crypto.randomUUID()` (global Web Crypto, no import) and every `.insert()`/`.update()` needs `updatedAt: new Date().toISOString()` explicitly. `createdAt`/`paidAt` DO have DB defaults (`CURRENT_TIMESTAMP`) — omit them unless overriding.
- **List/search endpoints:** write the matching logic as a `LANGUAGE sql STABLE` set-returning function (e.g. `search_patients`) and let PostgREST page it: `.rpc(fn, args, { count: "exact" }).order(...).range(...)`. Use `strpos(lower(col), lower(term))`, not `ILIKE`/`.or()` filter strings — user input never becomes filter syntax or a wildcard.
- **`RETURNS TABLE` typegen:** every column is generated as non-null. Declare the honest nullable row type in the route and assign (`const rows: Row[] = data;` — widening needs no cast).
- **Deletes:** every FK to `appointments`/`patients` is `ON DELETE RESTRICT`. Multi-table deletes go in an RPC (`delete_patients`, `bulk_delete_appointments`) that removes prescriptions + payments first.
- **RPC errors:** Plain `PostgrestError` objects, not Error subclasses — match on `error.message` (`SLOT_CONFLICT`, `NOT_FOUND`) or `error.code` (`23505` unique violation). Helpers in `@/lib/supabase/rpc`.
- **New RPC functions:** `REVOKE ALL … FROM PUBLIC, anon, authenticated` + `GRANT EXECUTE … TO service_role`. Supabase default privileges grant `anon` EXECUTE explicitly — revoking from PUBLIC alone is not enough.
- **Embedded relations:** PostgREST only infers one-to-one from a unique *constraint*; Prisma `@unique` creates an *index*. For a 1:1 FK, promote it (`ADD CONSTRAINT … UNIQUE USING INDEX …`) or the embed returns an array (`[]` is truthy). Filtering on an embedded column needs `!inner` to exclude parent rows.

## Patterns to Avoid

- **`any` type:** TypeScript strict mode is on. Never use `any`.
- **`new Date()` for timezone work:** Always use Luxon. `new Date()` is UTC-naive and will produce wrong times.
- **Hardcoded `Asia/Kolkata`:** New code must use `clinic.timezone`. Only existing Phase 1 shims are exempt.
- **Hardcoded `DDCJ` prefix:** Use `clinic.shortName` from DB.
- **Cross-clinic queries:** Never query without a `clinicId` filter on tenant-scoped tables.
- **`prisma db push` for schema changes:** Use `prisma migrate dev` to maintain migration history.
- **Direct `process.env` access:** Use `@/env`.

## Testing Requirements

- **Unit:** Utility functions (phone normalization, patient ID generation, date helpers)
- **Integration:** API route handlers against a real test DB — no mocked Prisma/supabase
- **RPC migrations:** dry-run the whole migration inside `BEGIN … ROLLBACK` against the real DB and exercise every function before `prisma migrate deploy`
- **Data-layer conversions:** parity test — run the old Prisma implementation (from git) and the new one side by side on realistic fixtures and deep-compare JSON output
- **Admin-route E2E:** mint a session for an existing admin with `auth.admin.generateLink({ type: "magiclink" })` → `verifyOtp({ token_hash })` on an `@supabase/ssr` server client whose cookie jar you capture (no email sent; cookie format guaranteed correct). Drive routes over HTTP, then `auth.admin.signOut(accessToken)` and delete test rows.
- **Middleware:** verify on `next build && next start`, not `next dev` — Turbopack dev served stale edge-middleware builds and ignored shell env (e.g. `DEFAULT_CLINIC_SLUG`)
- **Auth:** Middleware session refresh and route protection

## Key Libraries

- `@prisma/client` + `@prisma/adapter-pg` — ORM with pg driver for Supavisor pooling
- `@supabase/supabase-js` + `@supabase/ssr` — Auth (server + browser clients)
- `luxon` — All date/time operations
- `zod` v4 — Schema validation (shared client/server)
- `json2csv` — CSV export (handles commas/quotes in data correctly)
- `next` v16 — App Router framework
- `tailwindcss` v4 — Styling

## Reference Documentation

- Prisma docs (v7 + adapter-pg): https://www.prisma.io/docs
- Supabase SSR auth: https://supabase.com/docs/guides/auth/server-side
- Luxon API: https://moment.github.io/luxon/api-docs/
- Zod v4 migration: https://zod.dev/v4
- Next.js App Router: https://nextjs.org/docs/app

## Skills

- **`emil-design-eng`** — Any component with interaction, animation, or motion
- **`impeccable`** — Any visual design work (typography, color, spacing, layout)
- **`interface-design`** — Run `/interface-design:init` at project start; `/interface-design:audit` before shipping UI
- **`ui-skills`** — Final compliance check before UI is considered done
