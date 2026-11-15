# Creavent

Creavent is a web platform that brings vendor-based community events together in one place.

- **Organizers** plan and promote their events.
- **Vendors** find events and secure spots.
- **Attendees** discover where to go and who will be there.

## Focus

The MVP is built around flea markets and flea market organizers. The platform is described in general terms (events, organizers, vendors, attendees) so it can later grow to bazaars, pop-ups, and similar gatherings.

## Documentation

- [Project details](docs/project-details.md): description, scope, the features for each role, and the features to be implemented after the MVP.
- [Feature specification](docs/feature-specification.md): detailed MVP behavior, rules, notifications, out-of-scope items, and open questions.
- [User flows](docs/user-flows.md): the main path for each task, with the edge cases ordinary users are likely to hit.
- [Data model](docs/data-model.md): tables, statuses, rules the database enforces, and retention.
- [Sitemap](docs/sitemap.md): every page in the MVP, who can open it, and the navigation.
- [Legal](docs/legal.md): positions and questions for the legal review before real users' data is collected.
- [Open questions](docs/open-questions.md): unresolved questions to discuss in future sessions.
- [Revenue model](docs/revenue-model.md): MVP payment approach, all candidate revenue strategies, and open questions.
- [Architecture](docs/architecture.md): tech stack, code structure, auth, jobs, files, environments, backups, and testing.
- [Development plan](docs/development-plan.md): build phases and milestones, how each feature is built, the definition of done, and progress.
- [Deployment](docs/deployment.md): what `render.yaml` creates on Render, the one-time setup, migrations, and what is not covered yet.
- [Documentation checklist](docs/documentation-checklist.md): documents still needed before development and UI design.

## Status

Phase 1 (accounts and approval) is merged ([Aycees/Creavent#12](https://github.com/Aycees/Creavent/pull/12)): sign up and sign in, email verification and password reset, uploads, vendor and organizer onboarding, admin organizer approvals, and the account page. See [Development plan §10](docs/development-plan.md#10-progress).

Phase 2 (events) is merged ([Aycees/Creavent#15](https://github.com/Aycees/Creavent/pull/15)): event drafts and the setup tabs, opening an event to vendors, vendor browsing and the vendor view of the event page, and the organizer's event list.

Phase 3 (the core loop) is built on `feat/phase-3-core-loop` ([Aycees/Creavent#16](https://github.com/Aycees/Creavent/issues/16)): applying with documents and preferred slots, reviewing applications, assigning slots (several per vendor when the organizer allows it, and set-aside slots for the organizer's own booth or sponsors), the vendor's application pages, proof of payment and its review, releasing and removing, both dashboards, and an end-to-end test of the main path.

## Development

Requirements: Node 24, pnpm 9, Docker (for local Postgres).

```
apps/web         Next.js (App Router), Tailwind v4, shadcn/ui (Radix)
apps/api         NestJS with Prisma, Better Auth, and pg-boss (the API and the worker)
packages/shared  Zod schemas and types shared by web and api
```

First run:

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
pnpm db:up
pnpm --filter @creavent/api exec prisma migrate dev
pnpm dev
```

In another terminal, the worker sends queued emails (after `pnpm dev` has built the API):

```bash
pnpm --filter @creavent/api dev:worker
```

Without a Resend key, set `EMAIL_DRIVER=log` in `apps/api/.env` and the worker prints each email, links included. Uploads need the R2 settings in `apps/api/.env.example`. Google sign-in shows only when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set.

Seed accounts for every Phase 1 screen, all with `SEED_PASSWORD` from `apps/api/.env`: `admin@creavent.test` (admin), `vendor@creavent.test` (vendor), `organizer@creavent.test` (approved organizer), and `pending@`, `pending2@`, `rejected@`, `later@creavent.test` (organizers in the other approval states). For Phase 2, `organizer@` has a draft missing its payment details and two events open to vendors (one with applications closed), and `pending@` has a ready draft that waits for approval. Seeded events have no cover image, so add one before saving an open event's details. For Phase 3, `vendor2@` to `vendor8@creavent.test` have applications to Lanang Holiday Flea in each state: submitted with a preferred slot, withdrawn, approved with no slot (asking for 2 slots), declined, two slots with payment waiting, a reserved slot, an overdue payment, and a removal without permission to apply again. Lanang Holiday Flea allows 2 slots per vendor and has A-16 set aside. `vendor@` has none there, so the Apply page can be tried by hand. Seeded applications and proofs have no files. Seeding again leaves existing accounts and events as they are.

```bash
pnpm db:seed
```

To start over with an empty local database (every account and upload record is deleted), then the seed:

```bash
pnpm db:reset
```

`db:reset` refuses to run unless `DATABASE_URL` points at this machine. Files already uploaded to R2 stay in the buckets.

If another Postgres already uses port 5432, put `POSTGRES_PORT=5435` in a `.env` at the repo root and use that port in `DATABASE_URL`.

The web app runs on http://localhost:3100 and forwards `/api/*` to the API on port 3001 ([Architecture §4.3](docs/architecture.md#43-sessions)).

`pnpm dev` starts the web app on port 3100 (fixed, so it never drifts onto the API's port), the API on 3001, and the shared package in watch mode. Keep `WEB_URL=http://localhost:3100` in `apps/api/.env`: the API only accepts sign-ins from that address and puts it in email links. If the API fails with `EADDRINUSE`, another dev server still holds 3001 or 3100. Stop it (`lsof -i :3001` shows which), then run `pnpm dev` again.

Other commands: `pnpm build`, `pnpm lint`, `pnpm typecheck`, `pnpm test`.

The end-to-end test of the main path (sign up, onboard, approve, open an event, apply, assign, pay, confirm) runs locally against a running app and the R2 dev buckets, not in CI. Start `pnpm dev`, seed once, then:

```bash
pnpm --filter @creavent/web exec playwright test
```

It reads `apps/api/.env` for `WEB_URL`, `DATABASE_URL`, and `SEED_PASSWORD`, and `E2E_BASE_URL` overrides the address. Each run signs up two new accounts. The API allows 10 sign-ups an hour from one address, kept in memory, so restart the API if a run says "Too many signups from here".

### Design system

- **Tokens** live in `apps/web/src/styles/tokens.css`, taken from the mockup's `creavent.css` and the [Design brief](docs/design-brief.md). Tailwind's default colors, type sizes, radii, shadows, and breakpoints are turned off, so only Creavent tokens work: `bg-surface`, `text-ink`, `text-h2`, `rounded-lg`, `shadow-sm`, and one breakpoint, `md` (760 px).
- **Components** live in `apps/web/src/components/ui`. Shadcn components are restyled to the tokens. Creavent-only pieces (logo, date stamp, badge, approved mark, slot tile, steps, chip, choice card) are written by hand.
- **Showcase:** http://localhost:3100/dev/ui shows every token and component. It is not served in production.
- **Icons:** Phosphor, regular weight. Import from `@phosphor-icons/react/dist/ssr` in server components and from `@phosphor-icons/react` in client components.
- **Adding a shadcn component:** `pnpm dlx shadcn@latest add <name>` inside `apps/web`, then replace shadcn's color names (`bg-primary`, `text-muted-foreground`, `ring-ring`) with Creavent tokens. Those names don't exist here, so unconverted classes do nothing.
