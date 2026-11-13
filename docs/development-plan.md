# Creavent MVP Development Plan

**Status:** First draft, written 2026-11-13 after the codebase setup. Describes how the MVP is built: the order of work (phases and milestones), how one feature goes from docs to merged code, and what "done" means. It decides no product behavior. Rules live in the [Feature specification](feature-specification.md), steps in the [User flows](user-flows.md), pages in the [Sitemap](sitemap.md), tables in the [Data model](data-model.md), and technical choices in the [Architecture](architecture.md). If this file and those disagree, they win.

Last updated: 2026-11-13

## Contents

1. [The approach in short](#1-the-approach-in-short)
2. [Principles](#2-principles)
3. [Phases and milestones](#3-phases-and-milestones)
4. [Building one feature](#4-building-one-feature)
5. [Definition of done](#5-definition-of-done)
6. [Branches, pull requests, and deploys](#6-branches-pull-requests-and-deploys)
7. [Testing per feature](#7-testing-per-feature)
8. [Working with Claude](#8-working-with-claude)
9. [What blocks launch, not development](#9-what-blocks-launch-not-development)
10. [Progress](#10-progress)

## 1. The approach in short

- **Who builds it:** one developer working with Claude. Work happens one feature at a time, so there is never more than one feature half built.
- **Unit of work: the vertical slice.** A slice is one small, usable piece of a user flow, built end to end in one branch: shared schema, database migration, API, screens, tests, and seed data. It ships as one pull request.
- **Order of work: phases that end in a milestone.** Each phase ends with something a person can actually do on staging, such as "an approved organizer opens an event to vendors". There are no calendar dates. Progress is measured by milestones.
- **The critical path comes first.** The path to a confirmed spot (user flows 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8) is the product. It is built before the public pages, the admin tools beyond approval, and the polish.
- **The goal:** a pilot with one friendly organizer running a real event on Creavent (milestone M6). A pilot counts as real data, so it waits for the legal review ([Legal §1](legal.md#1-the-rule-until-the-review-is-done)).

Why slices instead of building all the backend, then all the frontend: every merged PR leaves the app working and testable on staging, mistakes in the docs show up early (when a screen meets real data), and a solo developer never carries a large unfinished change.

## 2. Principles

1. **Docs first, then code.** Every slice starts from the spec, flows, sitemap, and mockup. If building a slice shows the docs are wrong or silent, decide, update the doc in the same PR, and log the question in [Open questions](open-questions.md) if it needs discussion.
2. **The schema grows with the slices.** The data model is already designed, but tables are added to the Prisma schema when the first slice needs them, not all at once. Each slice's migration stays small and reviewable, and the model can still change cheaply before anything depends on it.
3. **Business rules live in the API and are tested there.** Status changes go through one function per entity ([Architecture §3.5](architecture.md#35-status-changes)). Permission checks and status rules get integration tests against real Postgres before the screen is built.
4. **`main` always works.** Every merge passes CI and deploys to staging. A slice that isn't ready to be seen is simply not linked from the navigation yet. No feature flag system until there is a real need.
5. **Build infrastructure when the first feature needs it.** File uploads arrive with the first upload, scheduled jobs with the first job. Phase 0 only has what every feature needs.
6. **Match the mockup, mobile first.** Screens use the components in `apps/web/src/components/ui` and the tokens. Each screen is checked at phone width (375 px) and desktop width against its mockup artboard.
7. **Seed data is part of the feature.** Each slice adds the seed rows that let anyone see its screens without clicking through the whole flow ([Architecture §5.3](architecture.md#53-migrations-and-seed-data)).

## 3. Phases and milestones

Phases run in order. Slices inside a phase usually run in the listed order, because later ones use earlier ones. Section references are to the [Feature specification](feature-specification.md) (spec), the [User flows](user-flows.md) (flow), and the [Sitemap](sitemap.md).

These build phases are separate from the documentation phases in the [Documentation checklist](documentation-checklist.md).

```text
Phase 0  Foundation              → M0  CI and the app shells work
Phase 1  Accounts and approval   → M1  An organizer signs up and gets approved
Phase 2  Events                  → M2  An approved organizer opens an event to vendors
Phase 3  The core loop           → M3  A vendor gets a confirmed spot (end-to-end test)
Phase 4  Public discovery        → M4  An attendee finds the event and its vendors
Phase 5  Admin and operations    → M5  The team can moderate and the jobs run
Phase 6  Launch readiness        → M6  Pilot with one friendly organizer
```

### Phase 0: Foundation

No user-facing features. Everything later depends on it.

| Slice | What it covers | Source |
|---|---|---|
| 0.1 CI | GitHub Actions: install, lint, typecheck, test on every PR. Postgres service for integration tests. | Architecture §9.2 |
| 0.2 Staging config | `render.yaml` for the web, api, and worker services and Postgres in Singapore, pre-deploy migrations, API health endpoint, and setup notes. Written now, deployed later: development stays local until the team decides to deploy (decided 2026-11-13). | Architecture §9 |
| 0.3 API conventions | Global Zod validation, one error response shape, OpenAPI generated by Nest Swagger, typed client generated into `packages/shared`, pino logging, helmet. | Architecture §3.4, §10 |
| 0.4 Test setup | API: Vitest with Testcontainers Postgres, a test factory for users and roles. Web: Vitest with Testing Library for component tests. | Architecture §11, CLAUDE.md |
| 0.5 Page shells | Public header and footer, signed-in shell (side menu, top bar, role switch, account menu), phone header, sticky action bar, vendor tab bar. Empty pages for every sitemap route, not linked yet. | Sitemap §5, Design brief §7, §10 |

**M0 is reached when:** a PR runs CI, and the shells render locally at phone and desktop width. Deploying to staging moves to whenever the team decides to deploy.

### Phase 1: Accounts and approval

| Slice | What it covers | Source |
|---|---|---|
| 1.1 Auth schema | Prisma schema for users, roles, legal acceptances, and Better Auth's tables. Settles the open point on mapping Better Auth onto `users` and updates the data model. | Architecture §4.2, §12, Data model §5.1 |
| 1.2 Email outbox | `email_notifications` table, pg-boss worker, Resend test sender, React Email base template. | Architecture §6 |
| 1.3 Sign up and sign in | `/signup`, `/login`, Google and password, email verification, forgot and reset password, rate limits, legal acceptance with versions, `/account/legal` redirect. | Spec §1, flow 1 |
| 1.4 File uploads | Ask, Upload, Complete, Attach with R2 dev buckets, sharp processing to WebP, metadata removal. Built here because onboarding needs avatars and logos. | Spec §11, Architecture §7 |
| 1.5 Vendor onboarding | Steps 1 to 4, saved progress, Finish later, done screen. | Spec §1.1, flow 1 |
| 1.6 Organizer onboarding | Steps 1 to 4, Submit for review or Do this later, pending screen, `/organizer/approval`. | Spec §1.1, §2.1, flow 2 |
| 1.7 Admin approvals | Admin flag and guard, `/admin/approvals` queue and detail, approve or reject with reason, approval emails, audit log helper. | Spec §2, §2.1, flow 11 |
| 1.8 Account page | `/account`: profile, email, password, contact number, roles. | Sitemap §2 |

**M1 is reached when:** on staging, a new user signs up as an organizer, verifies their email, finishes onboarding, submits for review, and an admin approves them. A vendor can finish onboarding too.

### Phase 2: Events

| Slice | What it covers | Source |
|---|---|---|
| 2.1 Create a draft | Events schema, `/organizer/events/new`, the Details tab (dates, multi-day, venue, cover, contact details, applications close, ingress). | Spec §3.1, §3.1.1, flow 3 |
| 2.2 Requirements and policy tabs | Allowed categories with limits, required documents, policy text. | Spec §3.2, §3.7 |
| 2.3 Payments tab | Payment options (channel, account details, QR as a private file), deadline hours. | Spec §6.1 |
| 2.4 Slots and floor plan tabs | Slot list, default price, "Add a row of slots", the two floor plan images. | Spec §3.4 |
| 2.5 Open to vendors | Event status-change function, the five-step checklist, approval check, Preview as vendor, open and close applications. | Spec §3.1, flow 3 |
| 2.6 Vendor browsing | Event page vendor view (`/events/[slug]`), `/vendor/events` with category spots left. | Sitemap §3, spec §4.2 |
| 2.7 Organizer dashboard (first version) | `/organizer` with Upcoming and Past tabs and each event's status and next step. Counts are added in Phase 3. | Spec §3.8 |

**M2 is reached when:** an approved organizer creates an event, fills every tab, opens it to vendors, and a vendor sees it in Browse events and on its event page.

### Phase 3: The core loop

The heart of the product. Most of the integration tests are written here ([Architecture §11](architecture.md#11-testing)).

| Slice | What it covers | Source |
|---|---|---|
| 3.1 Apply | Application with categories and documents (private files), policy snapshot, one active application per event, withdraw, new-application email. | Spec §4.2, flow 4 |
| 3.2 Review applications | `/organizer/events/[id]/applications`, approve or decline, category counters, emails. | Spec §3.3, flow 5 |
| 3.3 Assign a slot | Vendors and slots page, Assign slot, partial unique indexes, deadline set with the event start cap, payment instructions snapshot, slot-assigned email. | Spec §5, flow 6, Data model §6 |
| 3.4 Vendor application page | `/vendor/applications` and `/vendor/applications/[id]`: slot, amount due, payment options with copy buttons, timeline, organizer contact. | Spec §4.6 |
| 3.5 Pay and confirm | Proof upload (option paid with, amount, reference), proof review panel, approve or reject with reason, Mark paid with a note, overdue flag, emails. | Spec §6.2 to §6.5, flow 7 |
| 3.6 Release, remove, change | Vendor releases a slot, organizer removes a vendor or changes the slot, archiving of payment records, emails. | Spec §6.6, flow 9 |
| 3.7 Dashboards | Organizer to-do counts and slots at a glance, vendor dashboard with what needs action. | Spec §3.8, §4.6, Data model §7 |
| 3.8 End-to-end test | Playwright test of the main path: sign up, onboard, get approved, create and open an event, apply, approve, assign, upload proof, approve payment. | Architecture §11 |

**M3 is reached when:** the end-to-end test passes in CI, and the same path works by hand on staging on a phone.

### Phase 4: Public discovery

| Slice | What it covers | Source |
|---|---|---|
| 4.1 Announce and cancel | Announce (unpaid slots warning), cancel event, date, time, or place change emails, the hourly "mark completed" job. | Spec §3.1, flow 8, flow 9 |
| 4.2 Public event page | Public view of `/events/[slug]` for every status and viewer, accepted-vendor list, Get directions, Copy link, Open Graph tags, ISR refresh. | Sitemap §3, Architecture §8 |
| 4.3 Event listing | `/` with List and Calendar views, Next 7 days strip, filters (type, city, date), full-text search, weekend grouping. | Spec §7.3, flow 10 |
| 4.4 Organizer page | `/organizers/[slug]` with upcoming and past events. | Spec §7.1 |
| 4.5 Vendor page | `/vendors/[slug]` with "Find them next at" and "Where they've sold". | Spec §7.2, Data model §7 |
| 4.6 Static pages | `/approved`, `/terms`, `/privacy`, `/support` with placeholder legal text. | Sitemap §3 |

**M4 is reached when:** a signed-out visitor on a phone finds an announced event from the listing, opens it, and follows links to the organizer and vendor pages.

### Phase 5: Admin and operations

| Slice | What it covers | Source |
|---|---|---|
| 5.1 Reports | Report button, `/admin/reports`, add a report from a support email, dismiss, hide event, suspend. | Spec §2.2, flow 11 |
| 5.2 Users and events | `/admin/users` and `/admin/events`: search, suspend and reinstate per role, hide and show events, logged document views. | Spec §2, Sitemap §6 |
| 5.3 Admin overview | `/admin` counts and queues, admin search in the header. | Sitemap §6 |
| 5.4 Retention and cleanup jobs | 90-day deletion of payment records and documents, daily upload cleanup. | Spec §6.7, §11.7, Data model §8 |
| 5.5 Backups | Nightly `pg_dump` to R2 with a 30-day lifecycle rule. | Architecture §9.3 |

**M5 is reached when:** an admin can act on a report end to end, the jobs run on staging, and a backup file appears in the backups bucket.

### Phase 6: Launch readiness

| Item | What it covers | Source |
|---|---|---|
| 6.1 Legal answers | Lawyer's answers become configuration and content: terms, privacy notice, minimum age, retention days. | Legal, Open questions G |
| 6.2 Domain | Buy the domain, set the Resend sending domain and the public file domain. | Open questions E1, I2 |
| 6.3 Production | Production Render services and paid Postgres, environment group, production R2 buckets. | Architecture §9 |
| 6.4 Monitoring | Sentry on web and API, uptime checks. | Architecture §10 |
| 6.5 Restore drill | Restore a dump into a fresh database and write down the steps. | Architecture §9.3 |
| 6.6 Quality pass | Accessibility audit (WCAG 2.1 AA), phone performance check on the listing and event pages, security review of permissions and file access. | Design brief §13 |
| 6.7 Pilot | One friendly organizer runs a real event. Collect feedback and fix what blocks them. | |

**M6 is reached when:** the legal review is done, production is live on the real domain, and the pilot event has run on Creavent.

## 4. Building one feature

Every slice follows the same loop.

```text
pick slice → write acceptance criteria → branch → build bottom up → verify → PR → review → merge → check staging → update progress
```

### 4.1 Before code

1. **Pick the next slice** from [Progress](#10-progress). Open a GitHub issue for it, titled with the slice number and name ("3.3 Assign a slot").
2. **Gather its sources:** the spec sections, the flow and its edge cases, the sitemap entry, the data model tables, and the mockup artboards (desktop and phone).
3. **Write the acceptance criteria** in the issue as a checklist, in "Given, when, then" or plain sentences. Cover the main path and every edge case in the flow. Then copy them into [User flows](user-flows.md) under that flow, which fills the "User stories with acceptance criteria" item in the [Documentation checklist](documentation-checklist.md) one flow at a time.
4. **Settle open questions** the slice touches. If one needs discussion, stop and decide it first.

### 4.2 Build order inside a slice

Build from the data up, so each layer is tested before the next one uses it.

```text
1. packages/shared   Zod schemas and enums for the slice's requests and responses
2. apps/api/prisma   tables and migration (raw SQL for partial indexes and checks)
3. apps/api          module: guard, permission check, status-change function,
                     outbox rows, with integration tests written first for the rules
4. packages/shared   regenerate the typed API client
5. apps/web          screens from the mockup, forms with react-hook-form and the shared schemas
6. seed              rows that show every state of the new screens
7. e2e               only when the slice completes a milestone path
```

### 4.3 Size

- A slice should fit in one PR that can be read in one sitting, roughly under 800 changed lines, not counting the lockfile and generated files.
- If a slice grows past that, split it along the flow: the main path first, then the edge cases (for example, "3.5a Upload proof" and "3.5b Review proof").

## 5. Definition of done

A slice is done when all of these are true:

- [ ] Every acceptance criterion passes, checked by hand on a running app.
- [ ] Every new endpoint has a permission check and a test for it ([Architecture §4.4](architecture.md#44-permissions)).
- [ ] Status changes and rules are covered by integration tests.
- [ ] Every screen matches its mockup at 375 px and desktop width, with no horizontal page scroll.
- [ ] Every control is reachable by keyboard, has a visible focus ring, and is at least 44 x 44 px. Copy follows the [Design brief §4](design-brief.md#4-voice-and-content): sentence case, no em-dashes, "Approved by Creavent", peso and date formats.
- [ ] Emails the slice triggers go through the outbox and appear in the Resend test inbox.
- [ ] Seed data shows the new screens' states.
- [ ] CI is green: lint, typecheck, tests.
- [ ] Docs updated if behavior differs from them, in the same PR.
- [ ] After merge, the slice works on staging.

## 6. Branches, pull requests, and deploys

- **Trunk-based.** `main` is the only long-lived branch. Each slice gets a short-lived branch named `feat/<slice-number>-<short-name>` (for example, `feat/3.3-assign-slot`). Fixes use `fix/<short-name>`, docs use `docs/<short-name>`.
- **One slice per PR.** The PR body follows the team's PR template (summary, evidence, merge danger) and links the slice's issue. Evidence includes phone and desktop screenshots for screen changes.
- **Review.** Before merging, run Claude's code review on the branch, read the diff yourself against the acceptance criteria, and fix what it finds.
- **Squash merge**, so each slice is one commit on `main`.
- **Deploys.** Merging to `main` deploys to staging automatically, with migrations in the pre-deploy step. Before launch there is no production. After launch, production deploys follow the same path, and risky migrations (dropping or renaming columns) are split into two releases: add the new shape, move the code, then remove the old shape.
- **Local first.** Development runs locally until the team decides to deploy (decided 2026-11-13). Until staging exists, every "works on staging" check in this plan means "works on a local run from `main`".
- **Migrations are never edited after merge.** A mistake is fixed with a new migration.

## 7. Testing per feature

Following [Architecture §11](architecture.md#11-testing), most tests go where the product can break: assignments, payments, and permissions.

| When the slice adds | Write |
|---|---|
| A status change or business rule | Integration tests (Vitest and real Postgres) for each allowed and refused change, written before the code |
| An endpoint | An integration test for who can and can't call it |
| Pure logic (deadline math, date grouping, peso formatting) | Unit tests |
| A database rule (partial index, check) | An integration test that the database refuses the bad row |
| The last step of a milestone path | The Playwright test for that path |
| A screen or component | Component tests (Vitest and Testing Library) for what renders and how users interact, by role, label, and text, written first. Also checked by hand at both widths. |

## 8. Working with Claude

- **One slice per session.** Start the session with the slice number, and point Claude at this file and the slice's sources. Long sessions that mix slices lose context.
- **Ask for the acceptance criteria and a short plan first**, and agree on them before code. This catches misread docs early.
- **Use the skills:** `tdd` for the rules in the API, `db-entity-design` when adding tables, `code-review` before merging, `pr` for the PR body, and `diagnosing-bugs` when something breaks.
- **Keep `CLAUDE.md` current.** When a convention is settled during a slice (an error format, a folder layout, a naming rule), add one line so the next session follows it.
- **Check, don't trust.** Run the app and look at the screen, and read the tests. A green build doesn't prove a screen matches the mockup.

## 9. What blocks launch, not development

These don't stop any slice. They must be done before real users' data is collected (Phase 6).

| Item | Until then | Source |
|---|---|---|
| Legal review (terms, privacy notice, retention, minimum age) | Placeholder text and configuration defaults. Seed data and test accounts only. | [Legal §1](legal.md#1-the-rule-until-the-review-is-done) |
| Domain | Render's `*.onrender.com` addresses, Resend's test sender, R2's built-in public address | Open questions E1, I2 |
| Support email address | A placeholder in configuration | Data model §5.11 |

## 10. Progress

Check a slice when it is merged and works on staging. Note the PR next to it.

**Phase 0: Foundation**
- [x] Codebase setup: monorepo, web and API skeletons, design tokens and components ([Aycees/Creavent#4](https://github.com/Aycees/Creavent/pull/4))
- [ ] 0.1 CI
- [ ] 0.2 Staging config
- [ ] 0.3 API conventions
- [ ] 0.4 Test setup
- [ ] 0.5 Page shells
- [ ] **M0** CI and the app shells work

**Phase 1: Accounts and approval**
- [ ] 1.1 Auth schema
- [ ] 1.2 Email outbox
- [ ] 1.3 Sign up and sign in
- [ ] 1.4 File uploads
- [ ] 1.5 Vendor onboarding
- [ ] 1.6 Organizer onboarding
- [ ] 1.7 Admin approvals
- [ ] 1.8 Account page
- [ ] **M1** An organizer signs up and gets approved

**Phase 2: Events**
- [ ] 2.1 Create a draft
- [ ] 2.2 Requirements and policy tabs
- [ ] 2.3 Payments tab
- [ ] 2.4 Slots and floor plan tabs
- [ ] 2.5 Open to vendors
- [ ] 2.6 Vendor browsing
- [ ] 2.7 Organizer dashboard (first version)
- [ ] **M2** An approved organizer opens an event to vendors

**Phase 3: The core loop**
- [ ] 3.1 Apply
- [ ] 3.2 Review applications
- [ ] 3.3 Assign a slot
- [ ] 3.4 Vendor application page
- [ ] 3.5 Pay and confirm
- [ ] 3.6 Release, remove, change
- [ ] 3.7 Dashboards
- [ ] 3.8 End-to-end test
- [ ] **M3** A vendor gets a confirmed spot

**Phase 4: Public discovery**
- [ ] 4.1 Announce and cancel
- [ ] 4.2 Public event page
- [ ] 4.3 Event listing
- [ ] 4.4 Organizer page
- [ ] 4.5 Vendor page
- [ ] 4.6 Static pages
- [ ] **M4** An attendee finds the event and its vendors

**Phase 5: Admin and operations**
- [ ] 5.1 Reports
- [ ] 5.2 Users and events
- [ ] 5.3 Admin overview
- [ ] 5.4 Retention and cleanup jobs
- [ ] 5.5 Backups
- [ ] **M5** The team can moderate and the jobs run

**Phase 6: Launch readiness**
- [ ] 6.1 Legal answers
- [ ] 6.2 Domain
- [ ] 6.3 Production
- [ ] 6.4 Monitoring
- [ ] 6.5 Restore drill
- [ ] 6.6 Quality pass
- [ ] 6.7 Pilot
- [ ] **M6** Pilot with one friendly organizer
