# Operations Context — HealthHub PMS

## Infrastructure

- **Platform:** Cloudflare Workers via OpenNext (`@opennextjs/cloudflare`), Worker name `dentalis-pms`. **Not yet deployed** — the account, DNS and secrets are still to do (see `Planning/CLOUDFLARE_MIGRATION_PROGRESS.md`).
- **Database + Auth + Storage:** Supabase, project `apuxomkxwtjcoaqjhlux` (ap-northeast-2 — SaaS project, NOT the clinic)
- **Build system:** `next build` for the app; `opennextjs-cloudflare build` produces the Worker bundle (`.open-next/`). Bundle is ~2.3 MB gzip (Workers free plan limit: 3 MB).
- **Rate limiting:** Upstash Redis (in-memory fallback when unset — per-instance only, so not enforced across Worker instances)
- **Scheduled jobs:** Supabase `pg_cron` (`scripts/setup-pg-cron.sql`) — appointment status transitions. Nothing runs on the app platform.
- **Legacy (hands-off):** the original DDCJ clinic still runs on Vercel (`prj_iFvzmznya185EqJeL99DZhtTBLsE`, Supabase `erezwhfjexvnvxqaihae`). Do not touch it from this repo.

## Environment Variables

Worker runtime (set via `wrangler secret put` for secrets, `wrangler.jsonc` `vars` for non-secrets):

| Variable | Purpose | Set where |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (inlined at build time) | `.env.local` (build) + `wrangler.jsonc` vars |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publishable anon key (inlined at build time) | `.env.local` (build) |
| `NEXT_PUBLIC_APP_DOMAIN` | Root app domain (`healthhub.app`) | `wrangler.jsonc` vars |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret service role key (server-only) | `wrangler secret put` |
| `UPSTASH_REDIS_URL` / `UPSTASH_REDIS_TOKEN` | Rate limiting (optional, recommended in prod) | `wrangler secret put` |
| `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS` | Public booking rate limit (defaults 3 / 1h) | `wrangler.jsonc` vars |
| `TZ` | `Asia/Kolkata` | `wrangler.jsonc` vars |

Tooling only (never in the Worker):

| Variable | Purpose | Where |
|---|---|---|
| `DIRECT_URL` | Session pooler (port 5432) — Prisma CLI migrations and `npm run db:types` | `.env` |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` / `SEED_ADMIN_NAME` / `SEED_CLINIC_SLUG` | Seed script inputs | shell, when running `scripts/seed-admin.ts` |

> `DEFAULT_CLINIC_SLUG` must **stay unset in production** (it makes the root domain resolve to a clinic). Local dev only.

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

### Production Deploy (once the Cloudflare account exists)
1. `npm run build` and `npx opennextjs-cloudflare build` — both must pass
2. Confirm `wrangler deploy --dry-run` reports the bundle under the 3 MB gzip free-plan limit (or upgrade the plan)
3. Set secrets: `npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY` (plus Upstash keys)
4. DNS: `healthhub.app` on Cloudflare; route `*.healthhub.app/*` to the Worker, with the root domain going to `/register`
5. `npm run deploy` (`opennextjs-cloudflare build && opennextjs-cloudflare deploy`)
6. Confirm pending migrations are applied: `npx prisma migrate status`
7. Smoke test: `/register`, a clinic subdomain's booking form, admin login, and a payment on an appointment

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
