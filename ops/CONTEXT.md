# Operations Context — HealthHub PMS

## Infrastructure

- **Platform:** Cloudflare Workers via OpenNext (`@opennextjs/cloudflare`), Worker name `dentalis-pms`, deployed by Workers Builds from `main` on the client's Cloudflare account. Testing on `dentalis-pms.<account>.workers.dev` until a domain is bought.
- **Database + Auth + Storage:** Supabase, project `apuxomkxwtjcoaqjhlux` (ap-northeast-2 — SaaS project, NOT the clinic)
- **Build system:** `next build` for the app; `opennextjs-cloudflare build` produces the Worker bundle (`.open-next/`). Bundle is ~2.3 MB gzip (Workers free plan limit: 3 MB).
- **Rate limiting:** Upstash Redis (in-memory fallback when unset — per-instance only, so not enforced across Worker instances)
- **Scheduled jobs:** Supabase `pg_cron` (`scripts/setup-pg-cron.sql`) — appointment status transitions. Nothing runs on the app platform.
- **Legacy (hands-off):** the original DDCJ clinic still runs on Vercel (`prj_iFvzmznya185EqJeL99DZhtTBLsE`, Supabase `erezwhfjexvnvxqaihae`). Do not touch it from this repo.

## Environment Variables

Two separate places, because Next.js inlines `NEXT_PUBLIC_*` into the bundle at **build** time while everything else is read at **run** time. Workers Builds has no `.env`, and `src/env.ts` only requires the `NEXT_PUBLIC_*` vars during `next build`.

| Variable | Purpose | Build (Workers Builds → Settings → Build → Variables) | Runtime |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | ✅ required | `wrangler.jsonc` vars |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publishable anon key | ✅ required | Worker secret |
| `NEXT_PUBLIC_APP_DOMAIN` | Root app domain (`healthhub.app`) | optional (client falls back to `healthhub.app`) | `wrangler.jsonc` vars |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret service role key (server-only) | ❌ never | Worker secret |
| `UPSTASH_REDIS_URL` / `UPSTASH_REDIS_TOKEN` | Rate limiting (optional, recommended in prod) | ❌ | Worker secret |
| `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS` | Public booking rate limit (defaults 3 / 1h) | — | `wrangler.jsonc` vars |
| `TZ` | `Asia/Kolkata` | — | `wrangler.jsonc` vars |
| `DEFAULT_CLINIC_SLUG` | Which clinic `*.workers.dev` / localhost serves | — | `wrangler.jsonc` vars |

Worker secrets: dashboard (Worker → Settings → Variables and Secrets, type **Secret**) or `npx wrangler secret put <NAME>`. Plain-text vars set in the dashboard are **overwritten** by `wrangler.jsonc` on every deploy — change those in the file.

Tooling only (never in the Worker):

| Variable | Purpose | Where |
|---|---|---|
| `DIRECT_URL` | Session pooler (port 5432) — Prisma CLI migrations and `npm run db:types` | `.env` |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` / `SEED_ADMIN_NAME` / `SEED_CLINIC_SLUG` | Seed script inputs | shell, when running `scripts/seed-admin.ts` |

> `DEFAULT_CLINIC_SLUG` only applies on `localhost` and `*.workers.dev` (hosts that can't carry a clinic subdomain). It never affects `<slug>.healthhub.app` or the root domain.
>
> Don't run `npm run deploy` from a laptop with secrets in `.env`/`.env.local`: OpenNext bundles local `.env*` files into the Worker (`.open-next/cloudflare/next-env.mjs`). Deploy through Workers Builds instead.

## Deploy Process

### Development
1. `npm run dev` — dev server at http://localhost:3000
2. **Do not verify public routes on `next dev`** (clinic resolution via `DEFAULT_CLINIC_SLUG` is unreliable there). Use `npm run build && npx next start` with `DEFAULT_CLINIC_SLUG=<slug>`.
3. `npx prisma studio` for DB inspection

### Database Changes
1. Write a migration by hand in `prisma/migrations/<timestamp>_<name>/migration.sql` (plus `prisma/schema.prisma` if the schema changes)
2. Dry-run it inside `BEGIN … ROLLBACK` against the target DB and exercise the new functions
3. `npx prisma migrate deploy` (avoid `migrate dev` — its shadow-DB replay fails on the known history gaps)
4. `npm run db:types` — regenerate `src/generated/supabase/database.types.ts`, then commit it
5. Never use `prisma db push` except in early prototyping — it creates schema drift

### Seed / Setup
1. Create the clinic first (via `/register`, or a `clinics` row)
2. `SEED_ADMIN_PASSWORD=… SEED_CLINIC_SLUG=<slug> npx tsx scripts/seed-admin.ts`

### Production Deploy (Workers Builds, GitHub-connected — client's Cloudflare account)
Every push to `main` on `dentalis-clinic/healhubPMS` builds and deploys automatically.

One-time setup (Workers & Pages → Create → Import a repository):
- Repository: `dentalis-clinic/healhubPMS`, production branch `main`, root directory `/`
- Worker name: `dentalis-pms` (must match `name` in `wrangler.jsonc`)
- Build command: `npx opennextjs-cloudflare build`
- Deploy command: `npx opennextjs-cloudflare deploy`
- Build variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Runtime secrets: `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `UPSTASH_REDIS_URL`, `UPSTASH_REDIS_TOKEN`

Before merging to `main`:
1. `npx tsc --noEmit`, `npm run lint`, `npx opennextjs-cloudflare build` all pass
2. Bundle under the plan limit (`npx wrangler deploy --dry-run`; free plan: 3 MB gzip)
3. Migrations applied on the prod DB: `npx prisma migrate status`

Custom domain (not done yet): `healthhub.app` on Cloudflare DNS, proxied wildcard `*` record, Worker route `*.healthhub.app/*` plus the root domain.

Smoke test after deploy: `/register`, the booking form, admin login, an appointment with a payment. Watch errors with `npx wrangler tail dentalis-pms` or the Worker's Logs tab. Error 1102 = CPU limit → upgrade to Workers Paid.

### Pre-release Checklist
- `npx tsc --noEmit` and `npm run lint` pass
- `npx opennextjs-cloudflare build` passes, and the bundle is under the plan limit
- Manual test of core flows: booking form, login, appointment management, payments
- No hardcoded `DDCJ`, `Asia/Kolkata`, or `erezwhfjexvnvxqaihae` (old clinic Supabase) references in new code
- Env vars in sync between `.env` and `.env.local`
- Migrations applied on the prod DB
- Update `Planning/CONTEXT.md` roadmap if a phase completed

## Runbook Conventions

- Runbooks go in `ops/runbooks/`
- Each runbook covers one operational task
- Format: numbered steps, copy-pasteable commands, "Verify" step at the end

## Monitoring

- Cloudflare dashboard (Workers logs / `wrangler tail`) for runtime errors — once deployed
- Supabase dashboard for DB health and auth logs
- No application-level monitoring yet — add before Phase 4 billing goes live

## Skills

- No specific ops skills configured yet
