# Creavent Open Questions

Questions found while checking that the docs line up. They are not blocking the current docs, but each one needs a decision before the related work starts (user flows, domain model, UI, development).

Last updated: 2026-11-12

How to use this file: discuss a question in a session, write the decision into the right doc ([Feature specification](feature-specification.md), [Project details](project-details.md), or [Revenue model](revenue-model.md)), then move the question to the "Resolved" section at the bottom with the date.

"Suggested" is a starting point, not a decision.

## A. Payments

All questions in this section are resolved. See "Resolved" below. A8 (one payment for several slots) was dropped because a vendor can hold only one slot per event for now (B2). Bring it back if that limit is lifted.

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

These are tracked in detail, with the full question list for the lawyer, in [Legal](legal.md). Development continues in the meantime, with seed data only.

| # | Question | Suggested |
|---|---|---|
| G1 | **E-signature (post-MVP):** contract signing is moved out of the MVP. Before it is built, is a typed name plus a drawn signature acceptable under the Philippine E-Commerce Act? | Confirm with a lawyer before building contract signing. |
| G2 | **Record retention (90 days after the event):** does it fit the Philippine Data Privacy Act for payment records and permits? Are there duties to delete earlier on request? | Confirm with a lawyer. Allow deletion requests, with disputes as an exception. |
| G3 | **Data Privacy Act registration and a privacy notice:** do we need to register with the National Privacy Commission, and what must the notice say? (We store permits, which can include health certificates, and payment screenshots. No IDs or selfies in the MVP.) | Confirm with a lawyer before launch. |
| G4 | **Terms of use:** who is responsible when an organizer or vendor breaks an agreement, and how is the "payments happen outside Creavent" notice worded? | Draft with a lawyer. |
| G5 | **Tax:** is the free MVP free of tax duties? When do fees trigger VAT and registration? | Revisit before fees start. See [Revenue model](revenue-model.md#6-open-questions). |

## H. Documentation housekeeping

All questions in this section are resolved. See "Resolved" below.

## I. File uploads

| # | Question | Suggested |
|---|---|---|
| I2 | **Public file domain:** the public bucket needs a custom domain on Cloudflare. R2's built-in public address is rate limited and meant for development only. | Pick the domain first (H1), then serve public files from a subdomain such as `files.<domain>`. Use the built-in address in development only. |

## Resolved

Decisions are written into the [Feature specification](feature-specification.md) (sections 1, 2, 2.1, 3.1, 3.3, 3.4, 4.2, 5, 6.1, 6.3, 6.4, 6.6, 7, 8, 9, 10, and 11).

**MVP simplification on 2026-11-12.** Several earlier decisions below were replaced when the MVP was simplified (spec §9). Each replaced row says so. In short: no identity verification (organizers are approved from public links, and vendors need no approval), organizer assignment is the only slot mode, floor plans are two uploaded images, payment deadlines are shown but not enforced, no messaging, no attendee accounts, fewer admin tools, and no HEIC.

| # | Decision | Date |
|---|---|---|
| S1 | Identity verification (ID, selfie) is deferred. Organizers are approved by an admin from their social media and past event links, and show an "Approved by Creavent" badge. Vendors need no approval. Vendors upload permits when applying, and requirements are shown only to signed-in vendors. | 2026-11-12 |
| S2 | Organizer assignment is the only slot mode. Slots are a list. Floor plans are two optional images: one with empty slots for vendors, one with vendors placed for attendees. | 2026-11-12 |
| S3 | Payment deadlines are shown, not enforced. Overdue payments are flagged, and the organizer removes the vendor if needed. No reminders, retry windows, or extensions. | 2026-11-12 |
| S4 | No in-app messaging. Vendors see the organizer's contact details, and organizers see applicants' contact numbers. | 2026-11-12 |
| S5 | No attendee accounts, follows, saved events, or optional emails. Attendees report through the support email. | 2026-11-12 |
| S6 | Admins approve organizers, suspend, hide events, and handle reports. No "view as user", no acting on behalf, no category or settings pages, no automatic freeze. Account deletion is by email to support. | 2026-11-12 |
| S7 | JPEG, PNG, and WebP only (no HEIC), one stored size per image, and no bounced-email tracking. Closes I1. | 2026-11-12 |
| A3 | *Replaced by S3.* After a rejected proof, the vendor gets a fresh 12-hour window to upload again, capped at the event start. | 2026-11-11 |
| A4 | *Replaced by S3.* The deadline clock stops once proof is uploaded and stays stopped until the organizer decides. A hold cannot expire while proof is waiting for review. | 2026-11-11 |
| A5 | *Replaced by S3.* The organizer can extend a single vendor's deadline or retry window. | 2026-11-11 |
| A6 | The organizer can approve a payment without a proof image (cash on site, or paid by someone else), with a required note. | 2026-11-11 |
| A7 | No "Service fee: ₱0 (launch offer)" display in the MVP, since no screen shows a fee yet. Removed from the revenue model. | 2026-11-12 |
| B9 | The price and payment instructions are locked onto a slot when it is assigned. Later changes apply only to new assignments. Assigned and reserved slots cannot be deleted or renamed. (Updated for S2.) | 2026-11-11 |
| B10 | Events go `draft` → `open to vendors` → `announced` → `completed`, or `canceled`. Vendors apply, hold, and pay while the event is open to vendors, and attendees cannot see it yet. Organizers finalize vendors, then announce. | 2026-11-11 |
| B11 | *Replaced by S2.* After an event is announced, vendors cannot pick slots themselves. Open slots are filled only by organizer assignment. No payment deadline runs past the event start. | 2026-11-11 |
| D6 | *Replaced by S6.* When an organizer is suspended, their upcoming events are hidden and frozen, affected vendors are emailed with the support address, and an admin reinstates or cancels each event. | 2026-11-11 |
| D8 | Each time an admin opens a private document (an application document or a proof of payment), the view is written to the audit log. (Updated for S1, which removed verification documents.) | 2026-11-12 |
| D7 | One account can hold the vendor role, the organizer role, or both. (Updated for S1: only the organizer role needs approval.) | 2026-11-11 |
| B2 | A vendor can hold or reserve only one slot per event (for now). This replaces the earlier organizer-set limit (default 1). | 2026-11-11 |
| B3 | Slots can differ in size and price. The floor plan editor stays simple. | 2026-11-09 |
| B4 | No slot-move feature. To change slots, the organizer removes and reassigns. (Updated for S2.) | 2026-11-09 |
| B5 | *Replaced by S2.* Mode 2 slot categories come from the event's allowed categories. A vendor can pick any slot matching any of their categories. | 2026-11-09 |
| B6 | No cap on applications. When slots are full, vendors cannot hold a slot, but the organizer can still approve applications. | 2026-11-09 |
| B7 | Declined vendors can reapply. Removed vendors can reapply only if the organizer allows it. | 2026-11-09 |
| B8 | *Replaced by S2.* Changing the mode clears every unpaid hold in one step, after a warning that lists the affected vendors, who are emailed. Reserved slots block the change. Changed from "remove every hold first" on 2026-11-12. | 2026-11-12 |
| C1 | *Replaced by S2.* The floor plan is visible only once the organizer publishes it: to vendors while the event is open to vendors, and to attendees once it is announced. Vendor names appear only on reserved slots (payment approved by the organizer). Held slots show as "on hold" with no name. The accepted-vendors list shows vendors with a reserved slot only. Vendors see the same names. | 2026-11-09 |
| C2 | *Replaced by S5.* Following an organizer sends an email when they announce a new event. Optional emails carry an unsubscribe link. | 2026-11-09 |
| C3 | The listing shows upcoming events by date, with filters by location and date. | 2026-11-09 |
| C4 | Users sign in with Google, or with an email and password (verified at signup). No magic links. Changed from magic link on 2026-11-11. | 2026-11-11 |
| C5 | Only logged-in users can report a user or event. (Updated for S5: attendees use the support email.) | 2026-11-09 |
| C7 | Google sign-in on an account whose email was never verified verifies it and removes the old password. | 2026-11-12 |
| C6 | Attendees cannot contact organizers. No attendee messaging or contact form in the MVP. | 2026-11-09 |
| D1 | A small admin team, all with full access, and admin decisions are logged. No admin levels. (Updated for S6.) | 2026-11-09 |
| D2 | Organizers who are not approved can draft events but not open them to vendors. (Updated for S1.) Target review time is 1 to 2 business days. | 2026-11-09 |
| D3 | No separate appeal. Rejected organizers resubmit or email support, and an admin re-reviews. (Updated for S1.) | 2026-11-09 |
| D4 | Support is a support email address shown in the app. | 2026-11-09 |
| D5 | *Updated for S1.* A clear notice when payment instructions are shown, organizer approval from social media and past event history, and the report button. A dedicated scam-report process comes later. | 2026-11-09 |
| E2 | *Updated for S3 and S5: there are no optional emails, reminders, or message emails.* Required emails (verification, application, payment, deadline, hold, removal, cancellation and changes, messages) always send. Optional emails (followed-organizer events) have an unsubscribe link. | 2026-11-09 |
| E3 | The email is verified at signup. (Updated for S7: no bounce banner.) | 2026-11-09 |
| E4 | *Replaced by S4.* Messages show an in-app unread indicator in addition to the email. | 2026-11-09 |
| F1 | Launch in Davao City first. Currency is PHP, time zone is Asia/Manila, and the interface is in English with simple wording. | 2026-11-09 |
| F2 | *Replaced by S2.* The floor plan editor is desktop-only (view-only on mobile). Everything else is mobile-first. | 2026-11-09 |
| F4 | The MVP is free for everyone. The terms of use say fees may be introduced later with notice. | 2026-11-09 |
| H1 | "Creavent" is the final project name. No domain is used during development. On 2026-11-09, creavent.com was taken, and creavent.app, .co, .io, .net, .org, .events and getcreavent.com were available (.ph and .com.ph were not checked). Pick and buy a domain later, which also settles E1. | 2026-11-09 |
| H2 | Write user flows first, because they will expose gaps in the spec. | 2026-11-09 |
| I3 | Files are stored in Cloudflare R2 through the S3 SDK, and the API on Render handles all uploads. Browsers upload with short-lived signed URLs, and the API checks and re-encodes every file. | 2026-11-11 |
| I4 | Event covers, organizer logos, avatars, vendor photos, and floor plan images are public. Proofs of payment, payment QR codes, and application documents are private. (Updated for S1 and S2.) | 2026-11-11 |
| I5 | *Updated for S7.* Images accepted: JPEG, PNG, WebP, and HEIC (see I1). Documents may also be PDF. Public images get a `large` and a `small` size, and event covers are 16:9. Originals are not kept. | 2026-11-11 |
| I6 | No virus scanning in the MVP. PDFs are only allowed in private purposes and are served as downloads. | 2026-11-11 |

## Deferred with their features

Removed on 2026-11-09 because their features moved out of the MVP (see "Features to be implemented" in [Project details](project-details.md#features-to-be-implemented)). Bring them back when those features are built:
- Deposits, balance tracking: suggested to show the balance as information only, with a per-event fixed or percentage amount.
- Slot hold before the contract is signed: suggested that the same hold expiry applies.
- Contract changes after some vendors signed: suggested that signers keep their signed copy and new signers get the new one.
