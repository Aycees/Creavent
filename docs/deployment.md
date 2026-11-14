# Creavent Deployment

**Status:** Written, not used yet. Development stays local until the team decides to deploy (decided 2026-11-13). Nothing in this guide has been created on Render.

Last updated: 2026-11-13

This guide covers the staging setup in `render.yaml` at the repo root. The background is in [Architecture §9](architecture.md#9-environments-deploys-and-backups).

## 1. What render.yaml creates

One Render project, `creavent`, with one environment, `staging`, in Singapore:

| Resource | Type | What it does |
|---|---|---|
| `creavent-web-staging` | Web service (Node) | Next.js. Public. Forwards `/api/*` to the API over the private network. |
| `creavent-api-staging` | Web service (Node) | NestJS. Runs migrations before each deploy. Health check at `/api/health`. |
| `creavent-worker-staging` | Background worker (Node) | The same NestJS codebase, started from `dist/worker.js`. Runs pg-boss jobs: sends queued emails now, scheduled jobs and backups later. Serves no HTTP. |
| `creavent-db-staging` | Postgres 17 | The database. Reachable only from Render's private network. |
| `creavent-staging-secrets` | Environment group | Secret values, filled in the Render Dashboard. Attached to every service. |

How they connect:

- **Web to API:** the web service gets `API_HOSTPORT` (the API's private `host:port`) from the Blueprint. Its build and start commands turn it into `API_URL=http://<host:port>`, which `apps/web/next.config.ts` uses for the `/api` rewrite ([Architecture §4.3](architecture.md#43-sessions)). Blueprints have no variable interpolation, so this is done in the commands.
- **API and worker to database:** `DATABASE_URL` comes from the database's internal connection string.
- **Builds:** each service installs from the repo root with pnpm and builds its app and `packages/shared` with a pnpm filter. Node 24 comes from `.nvmrc`.
- **Build filters:** a service only rebuilds when its app, `packages/shared`, or the root package files change. Markdown changes, including everything in `docs/`, never trigger a build.
- **Auto-deploy:** a merge to `main` deploys staging ([Development plan §6](development-plan.md#6-branches-pull-requests-and-deploys)).

## 2. One-time setup

Done once, by a workspace admin, when the team decides to deploy.

1. **Check the health endpoint exists.** The API's health check is `/api/health`. Render will not mark a deploy healthy without it.
2. **Choose plans.** Every `plan` in `render.yaml` is a placeholder. Edit them on `main` before creating the Blueprint:
   - All three services need a paid plan. The API needs one for the pre-deploy command and to receive private network traffic.
   - The database needs a paid plan ([Architecture §9.3](architecture.md#93-backups)). Render's free database is not meant for real data.
3. **Create the Blueprint.** In the Render Dashboard: New, Blueprint, connect the GitHub repo, branch `main`. Render reads `render.yaml` and shows what it will create. Check the list matches section 1.
4. **Fill the secrets.** Open the `creavent-staging-secrets` environment group and add each secret value. Values are typed in the Dashboard only, never committed. Render does not allow `sync: false` placeholders inside a group, so the group starts empty. Each phase that needs a secret lists its keys in its PR.
5. **First deploy.** Check the build logs show Node 24 and pnpm 9, the pre-deploy step runs the migrations, and the health check passes.
6. **Seed staging.** Run the seed script once against the staging database ([Architecture §5.3](architecture.md#53-migrations-and-seed-data)), once the seed script exists.

Changes after setup go through `render.yaml` on `main`, not the Dashboard, except secret values.

## 3. Secrets and settings (Phase 1)

Add these to `creavent-staging-secrets`. `apps/api/.env.example` describes each one.

| Key | Used by | Notes |
|---|---|---|
| `BETTER_AUTH_SECRET` | API | 32+ random characters. Required in production. |
| `WEB_URL` | API, worker | The web service's address. Email links and Google's redirect use it. |
| `RESEND_API_KEY`, `EMAIL_FROM` | Worker | The worker refuses to start without the key. |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | API | An R2 API token for the two staging buckets. |
| `R2_PUBLIC_BUCKET`, `R2_PRIVATE_BUCKET`, `R2_PUBLIC_URL` | API | The private bucket needs a CORS rule allowing `PUT` from `WEB_URL` with the `Content-Type` header. `R2_PUBLIC_URL` is the public bucket's custom domain. Leave it empty until one exists: the API then serves pictures at `/api/files/public/...`. Don't use the r2.dev address, which some networks block. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | API | Optional. Redirect URI: `<WEB_URL>/api/auth/callback/google`. |
| `SUPPORT_EMAIL`, `TERMS_VERSION`, `PRIVACY_VERSION`, `MINIMUM_AGE` | API | Configuration with defaults (data model §5.11). |
| `SEED_PASSWORD`, `ALLOW_SEED=staging` | One-off seed run | Only when seeding staging. |

## 4. Migrations

- The API's pre-deploy command runs `prisma migrate deploy`. It runs after the build and before the new version starts.
- A failed migration stops the deploy, and the old version keeps running.
- Migrations are never edited after merge. Risky changes are split into two releases ([Development plan §6](development-plan.md#6-branches-pull-requests-and-deploys)).

## 5. Not covered yet

| Item | Brought by |
|---|---|
| Resend sending domain | Resend's test sender until open question E1. |
| Domain | Open question H1, item 6.2. Until then, services use `*.onrender.com`. |
| Backups | Feature 5.5 (nightly `pg_dump` to R2). Restore drill in item 6.5. |
| Production | Item 6.3: a second environment in `render.yaml`, with its own database and environment group. |
