# Migrate HealthHub PMS from Vercel to Cloudflare Workers

> **See `CLOUDFLARE_MIGRATION_PROGRESS.md` for current status.** This is the original plan; some details are now stale (worker name, the `next >=16.2.6` peer floor) and Phase 3's Prisma/Hyperdrive-proxy approach was superseded by a Supabase-client rewrite — the progress doc explains why and tracks what's actually done.

## Context

This app (multi-tenant dental clinic SaaS, not yet live in production) currently deploys to Vercel. The goal of this migration is **cost reduction**: Vercel Pro runs $20/mo per seat plus $0.15/GB egress after 1TB, while Cloudflare Workers Paid is $5/mo per account with zero egress charges and cheaper CPU-time-based billing — a meaningful gap for an I/O-bound app that spends most of its time waiting on Postgres/Supabase rather than burning CPU.

Investigation found the codebase is unusually clean for this move: no `@vercel/*` packages, no edge-runtime usage, `vercel.json` is `{}`, middleware already avoids Prisma in favor of fetch-based Supabase REST calls, and Prisma already uses the driver-adapter pattern (`@prisma/adapter-pg` + `pg`) rather than the Rust query engine — which is the pattern Cloudflare Workers requires. Database stays on Supabase (Auth + Storage + Postgres) — ripping out Supabase Auth would be a large rewrite for zero cost benefit, since Supabase's bill is orthogonal to which platform hosts the Next.js app. Cloudflare **Hyperdrive** is added as the Workers↔Postgres connection layer; this is Cloudflare's officially documented pattern for Supabase specifically (confirmed via their docs: Supabase is a named supported provider, `pg`/node-postgres is their recommended driver — exactly what this app already uses).

Deploy adapter: `@opennextjs/cloudflare` (OpenNext), not `@cloudflare/next-on-pages` (that forces edge runtime everywhere, which is incompatible with Prisma). **Confirmed blocker to resolve first:** OpenNext's Cloudflare adapter peer-requires `next >=16.2.6`; this repo is on `16.1.6`, so a Next.js patch bump is a required first step.

This is a full migration including actual deploy, but `wrangler login` (browser OAuth) and the final DNS nameserver cutover require the user's own live action — those are marked as human-in-the-loop checkpoints below, not steps to execute unattended. The app isn't live yet, which lowers the stakes of the DNS step, but we still keep Vercel undeleted as a rollback path until the Cloudflare deploy is verified end-to-end.

**Confirmed: `healthhub.app` is not on Cloudflare at all today** (no zone, no nameservers pointed there) — the DNS/nameserver move is a distinct, independent step with its own propagation delay (up to 24-48h), so it should be started early/in parallel with the codebase work, not left until the end.

## Non-goals

- Not migrating off Supabase (Auth/Storage/DB all stay).
- Not building Cloudflare Cron Trigger wiring — no cron route exists yet (`CRON_SECRET` is unused scaffolding); leave it as-is.
- Not rewriting `src/lib/utils/patient-token.ts`'s `crypto.randomBytes` usage preemptively — `nodejs_compat` should cover it; only touch it if verification proves otherwise.
- Not editing the 30 API routes' internals unless the Prisma/Hyperdrive prototype (step 4 below) proves the zero-edit approach doesn't work.

## Steps

### 1. Bump Next.js and add Cloudflare tooling
- `package.json`: bump `next` from `16.1.6` to the latest `16.x` patch that's `>=16.2.6`. Run the full test/build/lint loop after this bump alone, before touching anything else, since it's an independent risk.
- Add `@opennextjs/cloudflare` (dependency, not devDependency — it's imported by `open-next.config.ts` at build/runtime) and `wrangler` (devDependency).
- Add scripts: `"preview": "opennextjs-cloudflare build && opennextjs-cloudflare preview"`, `"deploy": "opennextjs-cloudflare build && opennextjs-cloudflare deploy"`, `"cf-typegen": "wrangler types --env-interface CloudflareEnv cloudflare-env.d.ts"`. Keep `dev`/`build`/`start`/`lint`/`postinstall` unchanged — `next dev` remains the local loop; OpenNext's build is an additional stage consuming the normal `.next` output.

### 2. `next.config.ts` — disable image optimization
All 4 `next/image` usages (`src/app/admin/login/LoginForm.tsx`, `src/app/page.tsx`, `src/app/register/RegisterWizard.tsx`, `src/components/admin/Sidebar.tsx`) point at the same local `public/logo.png`; remote clinic logos already use plain `<img>`, not `next/image`. So set `images.unoptimized = true` rather than standing up Cloudflare Images for a single static asset. Don't set `output: "standalone"` — OpenNext builds from Next's normal output.

### 3. `wrangler.jsonc` and `open-next.config.ts` (new files, repo root)
`wrangler.jsonc`: `name` (proposed: `healthhub-pms` — matches the repo's product name; confirm before first deploy since it's hard to rename later, it sets the `*.workers.dev` URL and Route bindings), `main: ".open-next/worker.js"`, `compatibility_date` set to the actual execution date, `compatibility_flags: ["nodejs_compat"]` (required — the generated Prisma client at `src/generated/prisma/client.ts:13-15` imports `node:process`/`node:path`/`node:url`), `assets` block (`.open-next/assets`, binding `ASSETS`), a `hyperdrive` binding block (id filled in during step 5), and non-secret `vars` (`NEXT_PUBLIC_APP_DOMAIN`, `NEXT_PUBLIC_SUPABASE_URL`, `TZ`, `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS`).

`open-next.config.ts`: minimal `defineCloudflareConfig({})` — confirmed no ISR/`revalidate` usage anywhere in the app (all relevant pages already use `export const dynamic = "force-dynamic"`), so no R2-backed incremental cache override is needed.

### 4. Prisma/Hyperdrive wiring — `src/lib/prisma.ts` (highest-risk step, prototype before rolling out)
Cloudflare Workers forbid reusing a connection opened in one request's execution context from a later request, so today's module-level singleton `PrismaClient` can't be used as-is on Workers, and the Hyperdrive connection string (`env.HYPERDRIVE.connectionString`) is only available inside a request's context via OpenNext's `getCloudflareContext()`, not at module load time.

**Try first (zero route edits):** make `prisma.ts` export a `Proxy` that, when running on Cloudflare (`getCloudflareContext({ async: true })` succeeds), lazily builds a `PrismaPg` client from `env.HYPERDRIVE.connectionString`, scoped per-request via a `WeakMap` keyed on the object `getCloudflareContext()` returns (itself `AsyncLocalStorage`-backed, so it's naturally distinct per request), and registers `ctx.waitUntil(client.$disconnect())`. Off Cloudflare (local dev, migrations, seed scripts), fall back exactly to today's existing singleton-on-`globalThis` behavior, unchanged.

**Prototype this against two specific routes first**, since they exercise the two trickiest call shapes: `src/app/api/dashboard/stats/route.ts` (`prisma.$queryRaw`) and `src/app/api/appointments/bulk-delete/route.ts` (interactive `$transaction`). If the Proxy approach can't cleanly support both, fall back to an explicit async `getPrisma()` factory and mechanically edit all 30 route files (`import { getPrisma } from "@/lib/prisma"` + `const prisma = await getPrisma();` inside each handler) — identical, scriptable edits, not a real refactor, but only take this path if the zero-edit approach fails.

Either way, `prisma.config.ts` stays **completely unchanged** — migrations always run from a dev machine/CI against `DIRECT_URL` (session pooler), never through the Worker.

**Also flag:** `src/env.ts`'s `validateEnv()` currently requires `DATABASE_URL`/`DIRECT_URL` as non-optional and throws at import time if missing. Since Workers won't have `DATABASE_URL` set as a secret (it reads the Hyperdrive binding instead), confirm at first boot whether this throws — relax those two fields to optional in the Zod schema if so, since they're genuinely unused in the Workers runtime path.

### 5. Provision Hyperdrive
1. **Human step:** in the Supabase dashboard, get the **Direct connection** string (Project Settings → Database) — a third, distinct string from both `DATABASE_URL` (transaction pooler) and `DIRECT_URL` (session pooler). Cloudflare's docs specify pointing Hyperdrive at this true direct connection since Hyperdrive does its own pooling. If it fails to connect (Supabase's direct connection is IPv6-only without the paid IPv4 add-on), fall back to the session pooler string instead.
2. **Human-in-the-loop checkpoint:** `wrangler login` (browser OAuth — cannot be done non-interactively).
3. `wrangler hyperdrive create healthhub-pms-db --connection-string="<direct connection string>"` → paste the returned `id` into `wrangler.jsonc`.

### 6. Env vars / secrets mapping
- Non-secret → `wrangler.jsonc` `vars`: `NEXT_PUBLIC_APP_DOMAIN`, `NEXT_PUBLIC_SUPABASE_URL`, `TZ`, `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS`.
- Server secrets → `wrangler secret put <NAME>` (user supplies real values, never fabricate placeholders): `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (technically public but kept out of committed config as a pragmatic choice), `UPSTASH_REDIS_URL`, `UPSTASH_REDIS_TOKEN` (must be set before first prod deploy — the in-memory rate-limit fallback isn't reliable on Workers), `CRON_SECRET` (optional, unused today).
- `DATABASE_URL`/`DIRECT_URL` are **not** set as Workers secrets at all — Workers reads the Hyperdrive binding instead; these remain local-dev/CI-only.
- `DEFAULT_CLINIC_SLUG` must stay **unset** in production so the root domain correctly falls through to `/register`.
- Update `.env.example` — add the two currently-undocumented vars `NEXT_PUBLIC_APP_DOMAIN` and `DEFAULT_CLINIC_SLUG` (both read directly via `process.env` in `middleware.ts`, bypassing `src/env.ts`'s schema entirely), and a comment noting Hyperdrive's separate Direct-connection string.

### 7. Wildcard subdomain routing
**Confirmed: `healthhub.app` is not on Cloudflare at all today.** Nameservers need to move — this is a distinct, independent step with its own propagation delay (can take up to 24-48h), so kick it off early (human adds the site/zone to Cloudflare, updates nameservers at the registrar) rather than leaving it until the deploy is otherwise ready. It does not block the codebase/build work in steps 1-6, but it does block the final DNS cutover in step 8 and should be started in parallel.

Once Cloudflare is authoritative for the zone: add a wildcard `*.healthhub.app` DNS record (proxied) + a Worker **Route** (not Custom Domain — those don't support wildcards) matching `*.healthhub.app/*` → the Worker, plus a route/custom domain for the apex `healthhub.app/*` and `www.healthhub.app/*` (middleware explicitly treats `www.<appDomain>` as root-domain traffic). Record the current Vercel DNS target values first, for rollback.

### 8. Deploy sequence
1. `opennextjs-cloudflare build` locally — first gate; watch for build warnings.
2. `opennextjs-cloudflare preview` — boots the Worker locally (Miniflare/workerd); confirms it doesn't throw at `src/env.ts` import time (step 4's flag).
3. Human runs `wrangler login`.
4. Provision Hyperdrive (step 5), set all secrets (step 6).
5. `wrangler deploy` → get the `*.workers.dev` URL.
6. **Smoke-test on `*.workers.dev` before any DNS change:**
   - `/register` and root path load.
   - Clinic-subdomain resolution: `curl -H "Host: <test-clinic-slug>.healthhub.app" https://<worker>.workers.dev/...` to exercise middleware's subdomain parsing + Supabase REST lookup pre-cutover.
   - `/admin/login` — full `@supabase/ssr` cookie auth flow.
   - `GET /api/dashboard/stats` (raw SQL) and `POST /api/appointments/bulk-delete` (transaction) — the two highest-risk Hyperdrive/Prisma paths from step 4.
   - A rate-limited route — confirm Upstash is actually being hit, not the memory fallback.
7. Only after a clean smoke test: DNS cutover (step 7) — nameservers if needed, wildcard + apex + www records/routes.
8. Post-cutover: real subdomain in a browser (booking form, admin dashboard, appointment CRUD), plus `wrangler tail` during the first live traffic window.
9. **Rollback:** keep the Vercel deployment live and undeleted for a defined window after cutover; if issues surface, revert DNS to the recorded Vercel values.

### 9. Cleanup (after migration is verified — separate, skippable commits)
- Delete `src/lib/config/clinic.ts` (confirmed zero importers — dead Phase-1 single-clinic config, superseded by the DB-backed `Clinic` model).
- Update `ops/CONTEXT.md` and `CLAUDE.md` (Vercel-specific platform/deploy/wildcard-domain/cron references) to describe Cloudflare Workers + OpenNext + Hyperdrive instead, and note that a future real cron feature should use a Cloudflare Cron Trigger + `scheduled()` handler, not the `CRON_SECRET`/`Authorization: Bearer` pattern the current comment describes.

## Critical files
- `src/lib/prisma.ts` — Hyperdrive wiring (step 4)
- `wrangler.jsonc`, `open-next.config.ts` — new (step 3)
- `next.config.ts` — image config (step 2)
- `package.json` — deps/scripts (step 1)
- `src/env.ts` — possible schema relaxation (step 4)
- `.env.example`, `ops/CONTEXT.md`, `CLAUDE.md` — docs (steps 6, 9)

## Verification
1. Build: `opennextjs-cloudflare build` succeeds with no unexpected warnings.
2. Boot: `opennextjs-cloudflare preview` boots without throwing.
3. DB: `GET /api/dashboard/stats` and `POST /api/appointments/bulk-delete` succeed against the `*.workers.dev` deploy — validates both the raw-SQL and interactive-transaction shapes through Hyperdrive.
4. Auth: `/admin/login` cookie flow works end-to-end.
5. Tenancy: subdomain resolution works via `Host`-header curl test pre-DNS, then via a real subdomain post-cutover.
6. Rate limiting: confirm Upstash path is hit (check Upstash dashboard or logs), not the in-memory fallback.
7. Rollback readiness: Vercel deployment confirmed still reachable throughout the post-cutover confidence window.
