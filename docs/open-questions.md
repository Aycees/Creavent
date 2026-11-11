# Creavent Open Questions

Questions found while checking that the docs line up. They are not blocking the current docs, but each one needs a decision before the related work starts (user flows, domain model, UI, development).

Last updated: 2026-11-11

How to use this file: discuss a question in a session, write the decision into the right doc ([Feature specification](feature-specification.md), [Project details](project-details.md), or [Revenue model](revenue-model.md)), then move the question to the "Resolved" section at the bottom with the date.

"Suggested" is a starting point, not a decision.

## A. Payments

| # | Question | Suggested |
|---|---|---|
| A6 | **Payments made by someone other than the vendor, or off-platform cash:** can an organizer mark a vendor as paid without a proof image (cash on site)? | Yes, with a note. The organizer can approve without proof. |
| A7 | **"Service fee: ₱0 (launch offer)":** the [Revenue model](revenue-model.md#launch-pricing-display) says to show this wherever a fee will appear, but the feature spec has no such display. | Drop it from the MVP, since there is nowhere a fee appears yet. Remove it from the revenue model, or add it to the spec if you still want it. |
| A8 | **One payment for several slots:** a vendor who holds two slots at the same event will likely send one transfer, but the spec asks for one proof per slot. | Let one proof upload cover several held slots at the same event. The organizer approves or rejects them together. |

A3 to A5 are resolved. See "Resolved" below.

## B. Slots, applications, and the vendor flow

All questions in this section are resolved. See "Resolved" below.

## C. Public visibility and attendees

All questions in this section are resolved. See "Resolved" below.

## D. Admin and operations

All questions in this section are resolved. See "Resolved" below.

## E. Email and notifications (Resend)

| # | Question | Suggested |
|---|---|---|
| E1 | **Sending domain and sender name** for Resend, and who owns the domain? | Decided to wait: decide when a domain is chosen. The domain is not used during development (see H1). |

E2 to E4 are resolved. See "Resolved" below.

## F. Product scope and market

| # | Question | Suggested |
|---|---|---|
| F3 | **How will the team measure the MVP learning questions** in [Revenue model](revenue-model.md#2-what-the-mvp-should-teach-us) while analytics are out of scope? | Deferred on 2026-11-09 until the revenue model is revisited. Suggested then: the team queries the database and reads the admin views by hand. |

F1, F2 and F4 are resolved. See "Resolved" below.

## G. Legal and compliance (needs a lawyer)

| # | Question | Suggested |
|---|---|---|
| G1 | **E-signature (post-MVP):** contract signing is moved out of the MVP. Before it is built, is a typed name plus a drawn signature acceptable under the Philippine E-Commerce Act? | Confirm with a lawyer before building contract signing. |
| G2 | **Record retention (90 days after the event):** does it fit the Philippine Data Privacy Act? Are there duties to delete earlier on request? | Confirm with a lawyer. Allow deletion requests, with disputes as an exception. |
| G3 | **Data Privacy Act registration and a privacy notice:** do we need to register with the National Privacy Commission, and what must the notice say? (We store IDs, selfies, permits, and payment screenshots.) | Confirm with a lawyer before launch. Restrict access to verification documents to admins. |
| G4 | **Terms of use:** who is responsible when an organizer or vendor breaks an agreement, and how is the "payments happen outside Creavent" notice worded? | Draft with a lawyer. |
| G5 | **Tax:** is the free MVP free of tax duties? When do fees trigger VAT and registration? | Revisit before fees start. See [Revenue model](revenue-model.md#6-open-questions). |

## H. Documentation housekeeping

All questions in this section are resolved. See "Resolved" below.

## Resolved

Decisions are written into the [Feature specification](feature-specification.md) (sections 1, 2, 2.1, 3.1, 3.3, 3.4, 4.2, 5, 6.1, 6.3, 6.4, 6.6, 7, 8, 9, and 10).

| # | Decision | Date |
|---|---|---|
| A3 | After a rejected proof, the vendor gets a fresh 12-hour window to upload again, capped at the event start. | 2026-11-11 |
| A4 | The deadline clock stops once proof is uploaded and stays stopped until the organizer decides. A hold cannot expire while proof is waiting for review. | 2026-11-11 |
| A5 | The organizer can extend a single vendor's deadline or retry window. | 2026-11-11 |
| B9 | The price and payment instructions are locked onto a slot when it is held or assigned. Later changes apply only to new holds. Held and reserved slots cannot be deleted, resized, or moved in the editor. | 2026-11-11 |
| B10 | Events go `draft` → `open to vendors` → `announced` → `completed`, or `canceled`. Vendors apply, hold, and pay while the event is open to vendors, and attendees cannot see it yet. Organizers finalize vendors, then announce. | 2026-11-11 |
| B11 | After an event is announced, vendors cannot pick slots themselves. Open slots are filled only by organizer assignment. No payment deadline runs past the event start. | 2026-11-11 |
| D6 | When an organizer is suspended, their upcoming events are hidden and frozen, affected vendors are emailed with the support address, and an admin reinstates or cancels each event. | 2026-11-11 |
| D7 | One account can hold the vendor role, the organizer role, or both. Each role has its own verification, and an approved vendor ID check counts toward organizer verification. | 2026-11-11 |
| B2 | A vendor can hold or reserve more than one slot per event, up to an organizer-set limit (default 1). Each slot has its own payment. | 2026-11-09 |
| B3 | Slots can differ in size and price. The floor plan editor stays simple. | 2026-11-09 |
| B4 | No slot-move feature. The vendor applies, is approved, then gets a slot according to the event's mode. To change slots, release a hold or have the organizer remove and reassign. | 2026-11-09 |
| B5 | Mode 2 slot categories come from the event's allowed categories. A vendor can pick any slot matching any of their categories. | 2026-11-09 |
| B6 | No cap on applications. When slots are full, vendors cannot hold a slot, but the organizer can still approve applications. | 2026-11-09 |
| B7 | Declined vendors can reapply. Removed vendors can reapply only if the organizer allows it. | 2026-11-09 |
| B8 | Mode can be changed only after all holds are removed or released, with a warning. Reserved slots block the change. | 2026-11-09 |
| C1 | The floor plan is public only once the organizer publishes it. Vendor names appear only on reserved slots (payment approved by the organizer). Held slots show as "on hold" with no name. The accepted-vendors list shows vendors with a reserved slot only. Vendors see the same names. | 2026-11-09 |
| C2 | Following an organizer sends an email when they publish a new event. Optional emails carry an unsubscribe link. | 2026-11-09 |
| C3 | The listing shows upcoming events by date, with filters by location and date. | 2026-11-09 |
| C4 | Attendees sign in with an email magic link or Google. | 2026-11-09 |
| C5 | Only logged-in users can report a user or event. | 2026-11-09 |
| C6 | Attendees cannot contact organizers. No attendee messaging or contact form in the MVP. | 2026-11-09 |
| D1 | A small admin team, all with full access, and every action on behalf of users is logged. No admin levels. | 2026-11-09 |
| D2 | Unverified organizers can draft events but not publish. Target review time is 1 to 2 business days. | 2026-11-09 |
| D3 | No separate appeal. Rejected users resubmit with new documents or email support, and an admin re-reviews. | 2026-11-09 |
| D4 | Support is a support email address shown in the app. | 2026-11-09 |
| D5 | A clear notice when payment instructions are shown, strong organizer verification (legitimate documents, valid ID, selfie, and social media or past event history), and the report button. A dedicated scam-report process comes later. | 2026-11-09 |
| E2 | Required emails (verification, application, payment, deadline, hold, removal, cancellation and changes, messages) always send. Optional emails (followed-organizer events) have an unsubscribe link. | 2026-11-09 |
| E3 | The email is verified at signup, and a banner appears if emails bounce. | 2026-11-09 |
| E4 | Messages show an in-app unread indicator in addition to the email. | 2026-11-09 |
| F1 | Launch in Davao City first. Currency is PHP, time zone is Asia/Manila, and the interface is in English with simple wording. | 2026-11-09 |
| F2 | The floor plan editor is desktop-only (view-only on mobile). Everything else is mobile-first. | 2026-11-09 |
| F4 | The MVP is free for everyone. The terms of use say fees may be introduced later with notice. | 2026-11-09 |
| H1 | "Creavent" is the final project name. No domain is used during development. On 2026-11-09, creavent.com was taken, and creavent.app, .co, .io, .net, .org, .events and getcreavent.com were available (.ph and .com.ph were not checked). Pick and buy a domain later, which also settles E1. | 2026-11-09 |
| H2 | Write user flows first, because they will expose gaps in the spec. | 2026-11-09 |

## Deferred with their features

Removed on 2026-11-09 because their features moved out of the MVP (see "Features to be implemented" in [Project details](project-details.md#features-to-be-implemented)). Bring them back when those features are built:
- Deposits, balance tracking: suggested to show the balance as information only, with a per-event fixed or percentage amount.
- Slot hold before the contract is signed: suggested that the same hold expiry applies.
- Contract changes after some vendors signed: suggested that signers keep their signed copy and new signers get the new one.
