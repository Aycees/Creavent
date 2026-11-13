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

Codebase set up: monorepo, web and API skeletons, and the design system from the UI mockup. No features built yet.

## Development

Requirements: Node 24, pnpm 9, Docker (for local Postgres).

```
apps/web         Next.js (App Router), Tailwind v4, shadcn/ui (Radix)
apps/api         NestJS with Prisma (schema not written yet)
packages/shared  Zod schemas and types shared by web and api
```

First run:

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
pnpm db:up
pnpm dev
```

The web app runs on http://localhost:3000 and forwards `/api/*` to the API on port 3001 ([Architecture §4.3](docs/architecture.md#43-sessions)).

Other commands: `pnpm build`, `pnpm lint`, `pnpm typecheck`, `pnpm test`.

### Design system

- **Tokens** live in `apps/web/src/styles/tokens.css`, taken from the mockup's `creavent.css` and the [Design brief](docs/design-brief.md). Tailwind's default colors, type sizes, radii, shadows, and breakpoints are turned off, so only Creavent tokens work: `bg-surface`, `text-ink`, `text-h2`, `rounded-lg`, `shadow-sm`, and one breakpoint, `md` (760 px).
- **Components** live in `apps/web/src/components/ui`. Shadcn components are restyled to the tokens. Creavent-only pieces (logo, date stamp, badge, approved mark, slot tile, steps, chip, choice card) are written by hand.
- **Showcase:** http://localhost:3000/dev/ui shows every token and component. It is not served in production.
- **Icons:** Phosphor, regular weight. Import from `@phosphor-icons/react/dist/ssr` in server components and from `@phosphor-icons/react` in client components.
- **Adding a shadcn component:** `pnpm dlx shadcn@latest add <name>` inside `apps/web`, then replace shadcn's color names (`bg-primary`, `text-muted-foreground`, `ring-ring`) with Creavent tokens. Those names don't exist here, so unconverted classes do nothing.
