# Cloudflare Migration — Progress Tracker

Living document. Update this whenever a phase starts, finishes, or changes shape — don't let it go stale like the original plan doc did. See `CLOUDFLARE_MIGRATION_PLAN.md` for the original plan; several of its details (worker name, Next.js version floor, and all of Phase 3's approach) are superseded below.

## Status at a glance

| Phase | Status | Summary |
|---|---|---|
| 0 — Decisions | ✅ Done | Worker name `dentalis-pms`; DB stays Supabase |
| 1 — Next.js bump + Cloudflare tooling | ✅ Done | Next 16.3.5, `@opennextjs/cloudflare`, `wrangler` added |
| 2 — `wrangler.jsonc` / `open-next.config.ts` scaffolding | ✅ Done | Also surfaced the `pg-cloudflare` build bug |
| 3 — Data layer for Workers (2 prototype routes) | ✅ Done | **Architecture changed** — see below. Also fixed an unrelated pre-existing build blocker |
| Rollout Batch 1 — typegen + `require-admin.ts` + 3 shared transactional helpers | ✅ Done (2026-09-27) | 7 files Prisma-free; 2 migrations applied; also fixed 2 latent ID-collision bugs, a 1:1-embed bug, RPC grants, and middleware header spoofing. Details: "What actually shipped" in `Planning/ROLLOUT_BATCH_1_PLAN.md` |
| Rollout Batch 2 — remaining Prisma-importing files | ✅ Done (2d closed 2026-10-04) | ✅ 2a `appointments/confirm` (2026-09-28): new `confirm_appointment` RPC (migration `20260928100000`), old `slot-conflict`/`patient-id`/`prescription-id` helpers deleted. ✅ 2b `patients` (2026-09-28). ✅ 2c CRUD by domain — payments, doctors, printable-templates, admin, clinic (2026-09-29). ✅ 2d pages, reports, onboarding, phone-check, lookup, list, shared utils (2026-10-04). **No app code imports Prisma any more.** Next: cleanup phase (see below). See Batch 2 log |
| DNS / Cloudflare account signup | ⬜ Deliberately deferred | User's choice: do this once code is ready to deploy |
| Secrets (`wrangler secret put`) | ⬜ Not started | Needs the account from the step above |
| Deploy & smoke test | ⬜ Not started | |
| Cleanup (dead config, docs) | ⬜ Not started | |

---

## Phase 0 — Decisions (done)

1. Cloudflare Worker name: **`dentalis-pms`** (the original plan doc says `healthhub-pms` in two places — stale, not corrected there, correct here).
2. Database: stays on Supabase. No change from the original plan.

## Phase 1 — Next.js bump + Cloudflare tooling (done)

- Bumped `next` **16.1.6 → 16.3.5** and `eslint-config-next` to match. Verified live against npm at execution time: the real `@opennextjs/cloudflare` peer floor is `>=16.3.3`, not the `>=16.2.6` the original plan doc states.
- Added `@opennextjs/cloudflare@^1.20.6` (dependency) and `wrangler@^4.135.0` (devDependency).
- Added `preview` / `deploy` / `cf-typegen` npm scripts.
- Set `images.unoptimized = true` in `next.config.ts`.
- Verified: `npm run build`, `npm run lint`, manual smoke test (root/register/admin-login, middleware redirect, logo rendering) — all clean.

## Phase 2 — `wrangler.jsonc` + `open-next.config.ts` (done)

- Created `wrangler.jsonc`: `name: "dentalis-pms"`, `nodejs_compat` + `global_fetch_strictly_public` compat flags, `assets` binding, a placeholder `hyperdrive` binding (`REPLACE_WITH_HYPERDRIVE_ID` — real id needs a Cloudflare account, deferred), and non-secret `vars`.
- Created `open-next.config.ts` (minimal `defineCloudflareConfig({})` — confirmed no ISR/`revalidate` usage anywhere in the app).
- Added `.gitignore` entries for `.open-next/`, `.wrangler/`, `cloudflare-env.d.ts`.
- **Finding**: running `opennextjs-cloudflare build` for real (not just `next build`) failed — `pg` (via `@prisma/adapter-pg`) has an optional dependency `pg-cloudflare` whose real `workerd`-conditional implementation gets dropped by Next's file tracer, while OpenNext's esbuild pass still tries to resolve it. This became the seed of Phase 3's real work.

## Phase 3 — Data layer for Workers (done, architecture changed)

### What the original plan assumed
Keep Prisma as-is everywhere, wrap `src/lib/prisma.ts` in a per-request Proxy pointed at a Cloudflare Hyperdrive binding (TCP connection to Postgres via `@prisma/adapter-pg`).

### Why that changed
Investigated the `pg-cloudflare` build failure properly instead of just patching around it. Findings, all sourced (GitHub issues, official docs, real repos — not guesses):
- The build failure is a **known, currently unresolved** upstream bug (`opennextjs-cloudflare#1214`) — community workaround exists (`outputFileTracingIncludes`), no official fix.
- There's a **separate, unresolved runtime bug** (`prisma/orm#28193`): `@prisma/adapter-pg` + Hyperdrive can crash with "memory access out of bounds," even with the correct per-request-client pattern.
- **No real production app was found** anywhere combining Next.js/OpenNext + Prisma + Postgres/Hyperdrive. Real Next.js-on-Workers apps use D1; real Postgres+Hyperdrive apps use plain Workers/Hono/Vite, not Next.js.
- Prisma's HTTP-native adapters (which would avoid `pg`/TCP entirely) only support a closed provider list with their own proprietary HTTP proxy — D1, Neon, PlanetScale, Turso. **Supabase isn't on that list** (its HTTP layer is PostgREST, not a Postgres-wire-protocol tunnel Prisma can use).
- Cloudflare's own Supabase integration docs (verified directly) present two sanctioned paths: `@supabase/supabase-js` (PostgREST/HTTP) for full-feature access, or Hyperdrive+`pg` for raw TCP SQL. This codebase's own `middleware.ts` already uses the first path, specifically to dodge Prisma on edge-style runtimes.
- User's call once Vercel was ruled out as an option: **use `@supabase/supabase-js` instead of Hyperdrive+Prisma** for the Workers runtime.

### What was actually done
- Applied the `pg-cloudflare` build workaround (`outputFileTracingIncludes` in `next.config.ts`, `pg-cloudflare` added as a direct dependency) — **still needed** as an interim measure since 39 routes still use Prisma.
- Added a new Prisma migration (`prisma/migrations/20260920184240_add_dashboard_stats_and_bulk_delete_rpc/`) containing two Postgres RPC functions: `get_dashboard_stats`, `bulk_delete_appointments`. Applied to the live Supabase DB (purely additive, no data touched). Both verified directly via raw SQL and via the real `supabase-js` client, including a cross-tenant delete-attempt safety check.
- Rewrote `src/app/api/dashboard/stats/route.ts` and `src/app/api/appointments/bulk-delete/route.ts` to call `createAdminClient().rpc(...)` instead of Prisma. Response shapes are byte-identical — no frontend changes needed.
- **Confirmed the build now fully succeeds**: `npx opennextjs-cloudflare build` completed end-to-end for the first time in this migration, and `pg-cloudflare`'s real `dist/index.js` was confirmed present in the output (proof the fix works, not just "didn't crash").

### Side-fix done in the same phase (not originally planned)
While verifying the build, found `npm run build` was actually broken on a **fully clean build** due to ~95 pre-existing TypeScript errors (`'data' is of type 'unknown'`) across ~20 unrelated files — masked until now by a stale local `.next/cache/.tsbuildinfo`. Root cause: a transitively-updated `@types/node@20.19.33` types `Response.json()` as `Promise<unknown>` instead of the old `any`. This likely also affects real Vercel deploys (which always build clean), independent of this migration. Fixed by adding `src/types/api.ts` (`ApiJson` type) and typing each call site precisely — no `any` used anywhere, per this repo's own rule.

### Deliberate interim state — do not "fix" this prematurely
*(Updated after Batch 1)* 9 of 41 Prisma-importing files are converted (Phase 3's 2 routes + Batch 1's 7: `require-admin.ts`, `dashboard.ts`, `appointments` POST, `appointments/[id]` PATCH, `appointments/follow-up`, `prescriptions` POST, plus `dashboard/stats` retyped). The other 39 still need Prisma, so:
- `wrangler.jsonc`'s `hyperdrive` binding and `nodejs_compat` / `global_fetch_strictly_public` flags **stay** — still required.
- The `pg-cloudflare` build workaround **stays** — still required.
- `src/lib/prisma.ts`, `prisma/schema.prisma`, `prisma.config.ts` — all unchanged. Prisma remains the schema/migration tool of record regardless of how far the Supabase-client rollout goes.

Only once **all 41 files** are converted (a future phase, not yet started) do Hyperdrive, `pg`, `pg-cloudflare`, and the build workaround become removable.

---

## What's left

1. **Rollout the remaining 39 files** from Prisma to `@supabase/supabase-js` (following the pattern from Phase 3), or decide not to and re-evaluate — this hasn't been explicitly re-confirmed as "yes, convert everything," only the 2-route prototype was approved so far.
   - ✅ Typegen is set up (`npm run db:types`, committed output). Batch 1 done; Batch 2 next.
2. **DNS / Cloudflare account signup** — user has deliberately deferred this until the code is ready to deploy. Not urgent, but budget 24-48h propagation once started.
3. **Provision Hyperdrive** — still needed for as long as any route uses Prisma/pg. Human-in-the-loop: Supabase direct connection string, `wrangler login`, `wrangler hyperdrive create dentalis-pms-db`.
4. **Secrets** — `wrangler secret put` for `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `UPSTASH_REDIS_URL`, `UPSTASH_REDIS_TOKEN`. User-run, not passed through the assistant.
5. **Deploy & smoke test** — `wrangler deploy`, curl-based + browser-based checks, per the original plan's step 8 (still valid).
6. **Cleanup** — delete dead `src/lib/config/clinic.ts`, update `ops/CONTEXT.md`/`CLAUDE.md` to describe Cloudflare instead of Vercel, and once all 41 files are converted: remove Hyperdrive/`pg`/`pg-cloudflare`/the build workaround.

## Batch 2 log

### 2a — `appointments/confirm` (done 2026-09-28)
- Flows B/C reuse `find_or_create_patient` + `create_appointment_atomic`. Flow A uses the new `confirm_appointment` RPC: patient patch + slot check + confirm in one transaction (conflict rolls back the patient edits, same as the old Serializable tx). It also re-checks the confirmable status *inside* the lock; the Prisma version checked outside the transaction, so a concurrently cancelled appointment could still be confirmed → now `NOT_CONFIRMABLE` → 400.
- Found: Prisma `@updatedAt` is client-side only (no DB default/trigger) → plain supabase-js `.update()` must set `updatedAt` explicitly. Added to `src/CONTEXT.md`.
- Verified: migration dry-run 11/11 (rolled back); **authenticated HTTP E2E 18/18** against the dev server with a minted admin session (all 3 confirm flows, rollback-on-conflict, plus follow-up / PATCH / prescriptions POST — closing Batch 1's unverified gap); `tsc`, eslint, `opennextjs-cloudflare build` ✅. Test rows + session cleaned up.

### 2b — `patients` routes (done 2026-09-28)
- `delete_patients(clinic, ids[])` serves both DELETE routes (single = array of one; 0 deleted → 404). Takes the per-clinic lock so a booking can't land between collecting and deleting a patient's appointments. Bulk DELETE's `deleted` now reports the *actual* count (was the requested length, incl. other clinics' ids; unused by the UI).
- `search_patients(clinic, search)` (set-returning, paged/counted by PostgREST) replaces the GET query. Literal `strpos` matching — `%`/`_` in a search are no longer wildcards.
- PATCH converted (sets `updatedAt` explicitly).
- **Live bug fixed** (pre-existing, ported unchanged in Phase 3): `bulk_delete_appointments` didn't delete payments; `payments_appointmentId_fkey` is `RESTRICT`, so bulk-deleting any appointment with a payment returned 500 from 3 UI call sites. Now deletes payments too — user chose this over blocking (2026-09-28), consistent with patient deletion.
- Verified: dry-run 16/16 (incl. reproducing the bug against the live function first); **GET parity old-Prisma vs new route byte-identical** across 7 search/pagination cases; authenticated HTTP E2E 18/18; `tsc`, eslint, `opennextjs-cloudflare build` ✅. 30 Prisma-importing files remain.

### 2c — payments, doctors, printable-templates, admin, clinic (done 2026-09-29)
- Plain CRUD, no new migrations. 12 route files converted: `payments` (POST/GET), `payments/[id]` (PATCH/DELETE), `payments/open-bills`, `doctors` (GET/POST), `doctors/[id]` (PATCH/DELETE), `printable-templates` (GET/POST), `printable-templates/[id]` (GET/PATCH/DELETE), `admin` (GET/POST), `admin/[id]` (PATCH/DELETE), `admin/[id]/reset-password`, `clinic/settings` (GET/PATCH), `clinic/logo` (POST/DELETE).
- Confirmed **no table has a DB default for `id` or `updatedAt`** (checked all 9). Added as a hard rule in `src/CONTEXT.md`.
- **Security fix**: `admin/[id]/reset-password` looked up the target admin with no `clinicId` filter (pre-existing, from the original Prisma code) — any admin could trigger a password-reset email for another clinic's admin. Added the clinic scope; verified cross-clinic now gets 404.
- **Found, not fixed** (pre-existing, unrelated to the conversion, flagged for the user): `clinic/settings` PATCH's `address: data.address ?? undefined` means explicitly clearing the address is a silent no-op (`null ?? undefined` drops the key before the request is sent). Preserved as-is; same bug existed in the Prisma version.
- `payments`→`admins` (recordedBy) and `appointments`→`doctors`/`patients` embeds confirmed as single objects (FK-owner side), not arrays — consistent with the pattern from Batch 1.
- Found a gap in `eslint.config.mjs`: `.open-next/**` wasn't in the ignore list (only `.next/**` was), so running `opennextjs-cloudflare build` before `npm run lint` in the same session made lint scan ~17k lines of bundled worker output (1830 fabricated "errors"). Fixed — unrelated to this batch's code but discovered while verifying it.
- Verified: authenticated HTTP E2E, 48/48 genuine checks (2 initial test-script false positives ruled out: `printable-templates` POST never returned 201 even in the original code, and one `reset-password` check hit Supabase Auth's own per-email cooldown, not a code path — confirmed via the dev server log's literal "For security purposes, you can only request this after N seconds"). `tsc`, eslint (post-fix), `opennextjs-cloudflare build` ✅. 18 Prisma-importing files remain (7 route files + `prescriptions/[id]` already-mixed + 7 page/layout files + 2 util files + 1 type-only).

### 2d — pages, reports, onboarding, phone-check, lookup, list, utils (done 2026-10-04)
- **0 app files import `@/lib/prisma`** now; `src/lib/prisma.ts` deleted. Type-only Prisma imports in `types/patient.ts` and `lib/constants/appointment.ts` moved to `Enums<>` from the Supabase types.
- Converted: 7 page/layout files (dashboard layouts, patients page, 4 prescription/template pages), `appointments/list`, `appointments/bulk-cancel`, `appointments/availability`, `phone-check`, `patients/lookup`, `prescriptions/[id]` GET, `reports/payments`, `onboarding/check-slug`, `onboarding/register`, `lib/utils/get-clinic-for-page.ts`.
- **Deleted** `lib/utils/resolve-appointment-status.ts`: zero callers, and the pg_cron script's own comment says it replaced it.
- **Shared helper**: `serializeAppointmentWithRelations` in `lib/supabase/serialize.ts` now serves both the dashboard fetcher and `appointments/list` (was duplicated logic).
- **Search**: `appointments/list` `q` reuses the `search_patients` RPC (literal matching, no PostgREST filter-string built from user input), then filters appointments by `patientId`. Side effect: email is now also matched (the original only matched name/phone/patientId) — a superset, flagged.
- **Schema drift found**: `clinics.phones` is nullable in the DB (Prisma's schema says non-optional). Guarded with `?? []`.
- **Gotcha**: `PostgrestBuilder` is `PromiseLike`, not `Promise` — no `.catch()`. Use `try { await … } catch {}` for best-effort cleanup.
- **Kept, flagged**: `api/prescriptions/[id]` GET has **no callers** in the app (the prescription page queries directly). Converted rather than deleted — it's an API surface, not an internal helper.
- **Remaining, out of app runtime**: `scripts/seed-admin.ts` and `scripts/normalize-patient-names.ts` still use Prisma directly. Local maintenance scripts; convert or remove in cleanup.
- Verified: authenticated E2E **46/46** against a production build (`next build && next start`, `DEFAULT_CLINIC_SLUG` set). Pages checked via rendered HTML. Test data and auth sessions cleaned up. `tsc`, eslint (0 errors), `opennextjs-cloudflare build` ✅.
- Test-run lessons: the public `phone-check` rate limit (10/hour/IP, in-memory) is consumed by repeated test runs — restart the server to reset. `next dev` ignores `DEFAULT_CLINIC_SLUG` (already noted in Batch 1), so public routes need the production build.

## Corrections to earlier notes in this file

- Phase 3 said "No RLS exists on any table" — **wrong**. RLS is *enabled* on every public table with *no policies* (deny-all for `anon`/`authenticated`; `service_role` bypasses). Verified 2026-09-27. Tenant isolation is still app-layer, but the anon key cannot read data.
- Phase 3's RPCs used `REVOKE … FROM PUBLIC` only, which left `anon` able to EXECUTE them (Supabase default privileges). Fixed in Batch 1's migration.

## Known stale spots in `CLOUDFLARE_MIGRATION_PLAN.md`

Not fixed there (out of scope to edit the original doc), but worth knowing:
- Says worker name `healthhub-pms` (should be `dentalis-pms`).
- Says `@opennextjs/cloudflare` needs `next >=16.2.6` (real floor confirmed `>=16.3.3`).
- Its entire "Step 4 — Prisma/Hyperdrive wiring" section describes the per-request Proxy approach that was superseded by the Supabase-client rewrite documented above.
