# Creavent Documentation Checklist

Tracks the documents needed before development and UI design. Check a box once the document is created.

Last updated: 2026-11-12

Legend: ⚠️ = the item is partly deferred until the final revenue model is decided after the MVP (see [Revenue model decision](#revenue-model-decision)).

## Done

- [x] Project details: description, scope, roles and features summary (`docs/project-details.md`)
- [x] Feature specification: detailed MVP behavior, rules, notifications, out of scope (`docs/feature-specification.md`)
- [x] Open questions log for future discussion (`docs/open-questions.md`)
- [x] Revenue model and strategy (`docs/revenue-model.md`): MVP decision made, final model deferred
- [x] Data model (`docs/data-model.md`): first draft
- [x] Technical architecture (`docs/architecture.md`)

## Phase 1: Foundation

- [ ] User flows and user stories with acceptance criteria (`docs/user-flows.md`)
  - [x] User flows with edge cases (first draft, 2026-11-11; updated 2026-11-12 for onboarding, vendor pages, event types, and the event listing)
  - [x] Include the manual payment flow: vendor uploads proof, organizer approves or rejects
  - [ ] User stories with acceptance criteria
- [ ] Domain model and business rules (`docs/domain-model.md`) ⚠️ partially
  - [ ] Entities and statuses (Event, Event Type, Application, Slot, Slot Assignment, Vendor Profile, Payment, Payment Proof, Notification, Report, Organizer Approval, Admin Audit Log, Event Policy)
  - [ ] Organizer approval rules (what's required, who approves)
  - [ ] Slot assignment rules (assignment, release, removal; no-shows are left to organizer policy)
  - [ ] Record retention and archiving rules
  - [ ] Visibility rules (public, draft, private data, and what the public vendor page shows)
  - [ ] Manual payment approval and refund rules (MVP)
  - [ ] Platform fees and payouts ⚠️ (deferred, post-MVP)
- [ ] Glossary (`docs/glossary.md`)

## Phase 2: UI design

- [x] Information architecture and sitemap (`docs/sitemap.md`) (first draft, 2026-11-12; updated the same day for vendor pages, onboarding, event types, and the event listing)
- [x] Design brief and brand basics (`docs/design-brief.md`) (first draft, 2026-11-12, from the mockup's design system)
  - [x] Audience and tone
  - [x] Logo direction: "Market grid" (chosen 2026-11-12, recorded in `docs/project-details.md`)
  - [x] Colors, typography, spacing, components, icons
  - [ ] Reference sites (none recorded; the mockup is the reference)
  - [x] Mobile-first guidelines
- [x] UI mockup of every MVP screen, desktop and phone: "Creavent UI Mockup (MVP)" (2026-11-12). The docs were aligned with it the same day (see `docs/open-questions.md`, section K)
- [x] Payment proof upload and approval screens (MVP)
- [x] Slot list and assignment, floor plan image upload, and admin organizer approval screens (MVP). Event setup has the Details (dates and hours, applications close, ingress), Payments (payment options, deadline), and Slots tabs drawn. The Requirements, Policy, and Floor plan tabs are listed but not drawn on their own
- [x] Onboarding screens, vendor page, and event listing (list, calendar, "Next 7 days") screens (MVP)
- [ ] Contract signing screens ⚠️ (deferred, post-MVP)
- [ ] Pricing, checkout, and payout screens ⚠️ (deferred, post-MVP)

## Phase 3: Technical

- [x] Technical architecture (`docs/architecture.md`)
  - [x] Stack, hosting, auth, file storage (proof-of-payment images and permits). Decided so far: Render for web, API, and database; Cloudflare R2 with the S3 SDK for files (spec §11)
  - [x] Email through Resend, and scheduled jobs (retention, cleanup, completing events)
  - [x] Role-based access, including admin access to all roles and an audit log
  - [x] Floor plan approach (uploaded images in the MVP)
  - [x] Payments approach: manual proof upload for MVP; online payment integration ⚠️ deferred
- [x] Data model / ERD (`docs/data-model.md`) (first draft, 2026-11-11)
  - [x] Payment and payment proof tables (MVP)
  - [x] Fee fields ⚠️ (designed on `payments`, unused until online payments)
- [ ] API outline (`docs/api.md`)

## Phase 4: Supporting (can run in parallel)

- [ ] Success metrics (`docs/success-metrics.md`) ⚠️ partially
  - [ ] MVP metrics: active organizers, events published, applications, slots filled, repeat organizers
  - [ ] Revenue metrics ⚠️ (deferred)
- [ ] Legal and compliance notes (`docs/legal.md`) ⚠️ partially (question list written 2026-11-12, lawyer review pending)
  - [x] MVP: Creavent holds no funds; privacy rules for proof-of-payment images and permits
  - [ ] Terms of use and privacy policy (retention, no-liability for payments)
  - [ ] Philippine Data Privacy Act and E-Commerce Act checks (see `docs/open-questions.md`)
  - [ ] Online payments, fund holding, and tax (VAT) ⚠️ (deferred, confirm with local accountant and lawyer)
- [ ] User and competitor research (`docs/research.md`) (optional)
  - [ ] Organizer and vendor interviews: slot prices, payment pain points, willingness to pay (see open questions in `docs/revenue-model.md`)

## Revenue model decision

**Decided for the MVP:** focus on gaining users. Payments are manual. Vendors pay organizers directly (any channel the organizer sets up) and upload proof of payment. Organizers approve or reject. No platform fee and no payment gateway integration. See `docs/revenue-model.md`.

**Deferred until after the MVP:** the final revenue model, including platform fees, online payments (for example, PayMongo), payouts, and any subscription or advertising options. All candidate strategies are listed in `docs/revenue-model.md`.

**Unblocked now:** everything, including payment-related items for the manual flow.

**Still deferred (⚠️):**
- Platform fees, online payments, and payouts rules
- Pricing, checkout, and payout screens
- Revenue-based success metrics
- Legal notes for online payments and tax
- Waitlist, deposit option, and event announcements. See "Features to be implemented" in `docs/project-details.md`.
- Contract signing (upload, e-signature, tracking) and its legal check under the E-Commerce Act. See "Features to be implemented" in `docs/project-details.md`.

**Interim approach:** record a payment as "amount, status, payer, payee", plus the proof image and the organizer's decision, without assuming any platform fee. Keep fee fields designed but unused so online payments can be added later without reworking the data model.
