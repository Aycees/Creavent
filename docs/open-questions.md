# Creavent Open Questions

Questions found while checking that the docs line up. They are not blocking the current docs, but each one needs a decision before the related work starts (user flows, domain model, UI, development).

Last updated: 2026-11-15

How to use this file: discuss a question in a session, write the decision into the right doc ([Feature specification](feature-specification.md), [Project details](project-details.md), or [Revenue model](revenue-model.md)), then move the question to the "Resolved" section at the bottom with the date.

"Suggested" is a starting point, not a decision.

## A. Payments

All questions in this section are resolved. See "Resolved" below. A8 (one payment for several slots) was dropped while a vendor could hold only one slot per event (B2), and was answered when that limit was lifted (P3).

## B. Slots, applications, and the vendor flow

All questions in this section are resolved. See "Resolved" below.

## C. Public visibility and attendees

All questions in this section are resolved. See "Resolved" below.

## D. Admin and operations

All questions in this section are resolved. See "Resolved" below.

## E. Email and notifications (Resend)

| # | Question | Suggested |
|---|---|---|
| E1 | **Sending domain and sender name** for Resend, and who owns the domain? | Deferred again on 2026-11-12: decide when the domain is bought, before staging needs to send real email. Suggested: sender name "Creavent", address `notifications@<domain>`. Until then, development uses Resend's test sender (see H1). |

E2 to E4 are resolved. See "Resolved" below.

## F. Product scope and market

All questions in this section are resolved. See "Resolved" below (F3 was decided on 2026-11-12).

## G. Legal and compliance (needs a lawyer)

These are tracked in detail, with the full question list for the lawyer, in [Legal](legal.md). **Deferred on 2026-11-12:** every legal question and document is settled before the platform launches to the public. Until then, development works around them with seed data and placeholders (see [Legal §1](legal.md#1-the-rule-until-the-review-is-done)). They block the public launch, not development.

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
| I2 | **Public file domain:** the public bucket needs a custom domain on Cloudflare. R2's built-in public address is rate limited and meant for development only. | Deferred again on 2026-11-12 with E1: pick the domain first (H1), then serve public files from `files.<domain>`. Until then the API serves public pictures, because some networks block the built-in r2.dev address (found 2026-11-14). Needed before staging is shared with testers. |

## J. Public pages, onboarding, and event types

All questions in this section are resolved. See "Resolved" below (J1 to J12, decided on 2026-11-12).

## K. Mockup alignment

All questions in this section are resolved. See "Resolved" below (K1 to K12, decided on 2026-11-12). The mockup fixes are listed under "Mockup fixes" below.

## L. Multi-day events and payment options

All questions in this section are resolved. See "Resolved" below (L1 to L4, decided on 2026-11-12).

## M. Preferred slots

All questions in this section are resolved. See "Resolved" below (M1 to M5, decided on 2026-11-14).

## N. Event policy

All questions in this section are resolved. See "Resolved" below (N1, decided on 2026-11-14).

## Resolved

Decisions are written into the [Feature specification](feature-specification.md) (sections 1, 1.1, 2, 2.1, 3.1, 3.3, 3.4, 4.2, 5, 6.1, 6.3, 6.4, 6.6, 7, 7.2, 7.3, 8, 9, 10, and 11).

**MVP simplification on 2026-11-12.** Several earlier decisions below were replaced when the MVP was simplified (spec §9). Each replaced row says so. In short: no identity verification (organizers are approved from public links, and vendors need no approval), organizer assignment is the only slot mode, floor plans are two uploaded images, payment deadlines are shown but not enforced, no messaging, no attendee accounts, fewer admin tools, and no HEIC.

| # | Decision | Date |
|---|---|---|
| S1 | Identity verification (ID, selfie) is deferred. Organizers are approved by an admin from their social media and past event links, and show an "Approved by Creavent" badge. Vendors need no approval. Vendors upload permits when applying, and requirements are shown only to signed-in vendors. | 2026-11-12 |
| S2 | *Partly replaced by M1.* Organizer assignment is the only slot mode. Slots are a list. Floor plans are two optional images: one with empty slots for vendors, one with vendors placed for attendees. | 2026-11-12 |
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
| B2 | *Replaced by P2.* A vendor can hold or reserve only one slot per event (for now). This replaces the earlier organizer-set limit (default 1). | 2026-11-11 |
| B3 | Slots can differ in size and price. The floor plan editor stays simple. | 2026-11-09 |
| B4 | No slot-move feature. To change slots, the organizer removes and reassigns. (Updated for S2.) | 2026-11-09 |
| B5 | *Replaced by S2.* Mode 2 slot categories come from the event's allowed categories. A vendor can pick any slot matching any of their categories. | 2026-11-09 |
| B6 | No cap on applications. When slots are full, vendors cannot hold a slot, but the organizer can still approve applications. | 2026-11-09 |
| B7 | Declined vendors can reapply. Removed vendors can reapply only if the organizer allows it. | 2026-11-09 |
| B8 | *Replaced by S2.* Changing the mode clears every unpaid hold in one step, after a warning that lists the affected vendors, who are emailed. Reserved slots block the change. Changed from "remove every hold first" on 2026-11-12. | 2026-11-12 |
| C1 | *Replaced by S2.* The floor plan is visible only once the organizer publishes it: to vendors while the event is open to vendors, and to attendees once it is announced. Vendor names appear only on reserved slots (payment approved by the organizer). Held slots show as "on hold" with no name. The accepted-vendors list shows vendors with a reserved slot only. Vendors see the same names. | 2026-11-09 |
| C2 | *Replaced by S5.* Following an organizer sends an email when they announce a new event. Optional emails carry an unsubscribe link. | 2026-11-09 |
| C3 | The listing shows upcoming events by date, with filters by location and date. (Updated for DD-C and DD-D: also filtered by event type, with List and Calendar views.) | 2026-11-09 |
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
| F3 | The MVP learning questions are answered with saved SQL queries kept in the repo (active and repeat organizers, events with applications, applications per event, slots filled, time to approve payments, rejected proofs, slot prices), run by hand each month. Event page views come from the hosting or Cloudflare traffic stats. No analytics service and no admin metrics page. | 2026-11-12 |
| F1 | Launch in Davao City first. Currency is PHP, time zone is Asia/Manila, and the interface is in English with simple wording. | 2026-11-09 |
| F2 | *Replaced by S2.* The floor plan editor is desktop-only (view-only on mobile). Everything else is mobile-first. | 2026-11-09 |
| F4 | The MVP is free for everyone. The terms of use say fees may be introduced later with notice. | 2026-11-09 |
| H1 | "Creavent" is the final project name. No domain is used during development. On 2026-11-09, creavent.com was taken, and creavent.app, .co, .io, .net, .org, .events and getcreavent.com were available (.ph and .com.ph were not checked). Pick and buy a domain later, which also settles E1. | 2026-11-09 |
| H2 | Write user flows first, because they will expose gaps in the spec. | 2026-11-09 |
| I3 | Files are stored in Cloudflare R2 through the S3 SDK, and the API on Render handles all uploads. Browsers upload with short-lived signed URLs, and the API checks and re-encodes every file. | 2026-11-11 |
| I4 | Event covers, organizer logos, avatars, vendor photos, and floor plan images are public. Proofs of payment, payment QR codes, and application documents are private. (Updated for S1 and S2.) | 2026-11-11 |
| I5 | *Updated for S7.* Images accepted: JPEG, PNG, WebP, and HEIC (see I1). Documents may also be PDF. Public images get a `large` and a `small` size, and event covers are 16:9. Originals are not kept. | 2026-11-11 |
| I6 | No virus scanning in the MVP. PDFs are only allowed in private purposes and are served as downloads. | 2026-11-11 |

**Design decisions on 2026-11-12 (DD-A to DD-G).** Written into the spec the same day. Follow-up questions are in section J.

| # | Decision | Date |
|---|---|---|
| DD-A | Public vendor pages are in the MVP at `/vendors/[slug]`, with no directory or search. They show profile content, "Find them next at", and "Where they've sold" (reserved slot at an announced event only). Phone, email, applications, documents, and payments are never shown. Hidden while the vendor is suspended or deleted. Vendors are told in onboarding and the terms. Replaces the earlier "not public in the MVP" rule. | 2026-11-12 |
| DD-B | Vendors have `social_links` (optional) and an editable `slug`. | 2026-11-12 |
| DD-C | Each event has one event type (Flea market, Bazaar, Pop-up), managed in seed data in an `event_types` table. Flea markets stay the focus. Attendees can filter by type. | 2026-11-12 |
| DD-D | The event listing has List and Calendar views, a "Next 7 days" strip, and a "Sell at these events" link with a count. | 2026-11-12 |
| DD-E | Signup asks "Sell at events" or "Run events", which only pre-selects the role in onboarding. The log in page has vendor and organizer account entry points. | 2026-11-12 |
| DD-F | Vendor and organizer onboarding are 4 steps each, start after email confirmation, and save progress ("Finish later"). Permits are not saved to the profile. | 2026-11-12 |
| DD-G | The logo is "Market grid", replacing the design system's "no other symbol" rule. | 2026-11-12 |

**Follow-up questions on 2026-11-12 (J1 to J12).** Raised by DD-A to DD-G and decided the same day by accepting the suggested answers.

| # | Decision | Date |
|---|---|---|
| J1 | Events canceled after they were announced are not shown on the vendor page. | 2026-11-12 |
| J2 | Slugs (vendors, organizers, events): lowercase letters, numbers, and hyphens, 3 to 40 characters. Reserved words are blocked. A number is added when the slug is taken. Slugs are editable and the old link redirects. | 2026-11-12 |
| J3 | The signup choice is not stored. It is only passed to onboarding. | 2026-11-12 |
| J4 | Onboarding fields are saved as entered, and the last completed step is kept per role (`user_roles.onboarding_step`). | 2026-11-12 |
| J5 | With both roles, the vendor flow runs first, then the organizer flow. Step 1 is shown once, and each flow shows its own "Step N of 4". | 2026-11-12 |
| J6 | A vendor cannot apply until the shop name, mobile number, and at least one category are set. An organizer cannot create an event until the display name and mobile number are set. | 2026-11-12 |
| J7 | Vendor city is optional and edited on the profile page, not in onboarding. | 2026-11-12 |
| J8 | Signed-out visitors see the number of events open to vendors (number only). The link goes to Browse events for a signed-in vendor. | 2026-11-12 |
| J9 | The weekend is Saturday and Sunday. Other days of the current week go under Later. | 2026-11-12 |
| J10 | A vendor whose page is not shown stays in the event's vendor list without a link. A deleted account shows "Deleted user". | 2026-11-12 |
| J11 | The event type can be changed until the event is announced. | 2026-11-12 |
| J12 | Profile rows stay as empty shells after account deletion (`slug` null, `social_links` empty). | 2026-11-12 |

**Mockup alignment on 2026-11-12 (K1 to K12).** The docs were compared with every screen of the "Creavent UI Mockup (MVP)". Where the mockup showed something the docs did not cover, the mockup was followed and written into the spec.

| # | Decision | Date |
|---|---|---|
| K1 | Events can have an optional applications close date (no later than the event start). After it, vendors can't apply. The organizer can still close applications by hand. | 2026-11-12 |
| K2 | Events have optional ingress details for vendors (for example, "From 3 PM, Gate 2"), shown to vendors with a slot. | 2026-11-12 |
| K3 | Slots have an optional note. Organizers can add a numbered row of slots at once. Vendors see slots grouped by row with open counts. | 2026-11-12 |
| K4 | A required document can apply to one category only (for example, a sanitary permit for food vendors). | 2026-11-12 |
| K5 | The "Open to vendors" checklist has five required steps: details with cover, requirements (at least one category), policy, at least one slot, and payment instructions. The vendor floor plan is optional. | 2026-11-12 |
| K6 | Event setup has "Preview as vendor". | 2026-11-12 |
| K7 | With the proof, the vendor enters the amount sent (pre-filled) and an optional reference number, and the organizer sees both. | 2026-11-12 |
| K8 | The organizer dashboard shows to-do counts per event and Upcoming and Past event tabs. The vendor dashboard is specified (spec §4.6). | 2026-11-12 |
| K9 | The public event page shows each accepted vendor's category and slot number, a category filter, "Get directions", "Copy link", and a "Details updated" date. The listing has date presets and counts per type. | 2026-11-12 |
| K10 | Suspension is per role (vendor or organizer), with a reason shown to the user. Hiding an event needs a reason, which is emailed to the organizer. | 2026-11-12 |
| K11 | Admins add reports received by support email, so all reports are in one queue. Reports have a reference number, are grouped by target, and have an internal note. Organizer reviews have an optional internal note. | 2026-11-12 |
| K12 | The links an organizer submits for approval are their public social links on the organizer page. Vendors who applied see the organizer's name, mobile, and contact email on their application page. | 2026-11-12 |

**Multi-day events and payment options on 2026-11-12 (L1 to L4).**

| # | Decision | Date |
|---|---|---|
| L1 | Events run 1 to 7 days in a row, with the same opening and closing time every day. No past-midnight hours, no different hours per day, and no non-consecutive dates. Stored in the existing `starts_at` and `ends_at`. | 2026-11-12 |
| L2 | Vendors are locked in for the whole multi-day event: one slot, one price, one payment. No single-day slots. A multi-day event shows on each of its days in the calendar and "Next 7 days" strip, goes under a weekend when any of its days is that Saturday or Sunday, and matches a date filter when any of its days does. The payment deadline and applications close date are capped at the first day's opening. | 2026-11-12 |
| L3 | Organizers add one or more payment options (GCash, bank transfer, QR, and so on). When uploading proof, the vendor selects the option they paid with, and the organizer sees it when reviewing (`payment_proofs.payment_method_id`). | 2026-11-12 |
| L4 | The mockup fixes are made in the mockup: "Vintage" as the category name, the payment option on the proof upload and review, and screen-reader labels on the badge seals (the badges were already there). Two Friday to Sunday markets are added to the mockup as multi-day examples. | 2026-11-12 |

**Preferred slots on 2026-11-14 (M1 to M5).** Prompted by a Davao organizer's registration form ("Holiday Rush"), where vendors tap a spot on a floor plan, see taken spots, and see prices per zone. A clickable floor plan with instant booking was judged too large for the MVP (it needs a map editor and slot holds), so this keeps the useful parts.

| # | Decision | Date |
|---|---|---|
| M1 | Each event has a slot mode, chosen by the organizer on the Slots tab: "I assign slots" (the default) or "Vendors choose a preferred slot". The organizer assigns every slot in both modes. The mode can change at any time, and preferences already sent are kept. Partly replaces S2. | 2026-11-14 |
| M2 | A preferred slot holds nothing. Several vendors can prefer the same slot, the organizer sees "Preferred by 2", and the slot stays open until someone is assigned. No expiry or first-come rules. The Assign slot dialog selects the preferred slot when it's still open. The preference can't be edited after applying (changed 2026-11-15: it can be changed until a slot is assigned, and an unpaid slot can be swapped for a new pick). | 2026-11-14 |
| M3 | Vendors pick the preferred slot on a new apply page (`/vendor/events/[slug]/apply`), from the vendor floor plan and the slots grouped by section, each marked Open or Taken, or "No preference". | 2026-11-14 |
| M4 | Slots get an optional section (for example, Indoor, Inner room, Outdoor). Vendors see slots grouped by section, or by label prefix when there is none. | 2026-11-14 |
| M5 | The vendor floor plan is uploaded at the top of the Slots tab and shown next to the slot list as a reference while adding slots. The public floor plan moves to a "Public floor plan" tab. The system still doesn't check that labels match the image. | 2026-11-14 |

**Event policy on 2026-11-14 (N1).**

| # | Decision | Date |
|---|---|---|
| N1 | The policy stays per event. A new event copies the policy of the organizer's most recent event, and the Policy tab says where it came from. A first event shows an example policy (configuration value `example_policy_text`), which counts for the checklist only after the organizer saves it. No global policy setting, so editing one event's policy never changes another's. | 2026-11-14 |

**Several slots and set-aside slots on 2026-11-15 (P1 to P6).** Organizers asked to keep slots for their own booth or sponsors, and vendors with bigger setups asked for more than one slot.

| # | Decision | Date |
|---|---|---|
| P1 | The organizer can set aside a slot for their own booth, a sponsor, or another arrangement, with an optional private note (for example, "Sponsor booth"). It's done from the slot's Edit dialog on the Slots tab, and undone the same way. A slot with a vendor can't be set aside. A set-aside slot can't be assigned or preferred: vendors see it as Taken, the organizer sees "Set aside", and it isn't counted as open. "Set aside" is used instead of "reserved", which already means a slot whose payment is approved. | 2026-11-15 |
| P2 | Each event has a "Slots per vendor" limit, from 1 (the default) to 10, set on the Slots tab. Replaces B2. Lowering it doesn't change applications or slots already given. | 2026-11-15 |
| P3 | A vendor's slots at one event are one unit: one assignment, one amount (the sum of the slot prices, locked when assigned), one payment, one deadline, and one proof. Closes A8. | 2026-11-15 |
| P4 | When applying, the vendor says how many slots they need, up to the limit. With "Vendors choose a preferred slot", they pick up to that many preferred slots, or "No preference". The number can't be changed after applying; the picks can, until a slot is assigned. | 2026-11-15 |
| P5 | The organizer assigns all of a vendor's slots in one step, from 1 up to the number asked for, with the preferred slots that are still open selected. There's no adding, dropping, or moving one slot of the set later, as with one slot (B4). | 2026-11-15 |
| P6 | Releasing, withdrawing, removing, or picking other slots acts on all of the vendor's slots together. The slots show as one line ("B-03, B-04") everywhere, and category limits still count vendors, not slots. | 2026-11-15 |

**Public discovery on 2026-11-16 (Q1 to Q8).** Settled before building Phase 4, from the Phase 4 mockups.

| # | Decision | Date |
|---|---|---|
| Q1 | Public pages (listing, event, organizer, vendor) are server-rendered and cached. Right after a change that affects them (edit, announce, cancel, a slot reserved or removed, a profile saved), the API asks the web app to refresh those pages through a refresh route protected by a shared secret. | 2026-11-16 |
| Q2 | An event canceled before it was announced shows signed-out visitors a short "This event was canceled" page with the name and dates only. Vendors see the vendor view marked canceled. An event canceled after it was announced shows the public view marked canceled, without the vendor list. | 2026-11-16 |
| Q3 | The hourly job marks only `announced` events `completed` after they end. An event that ends while only open to vendors stays `open_to_vendors` and counts as past everywhere, but never as an event held or in "Where they've sold". | 2026-11-16 |
| Q4 | Cancel event takes an optional reason. When given, vendors see it in the email and on the canceled event page as the organizer's note. | 2026-11-16 |
| Q5 | The event listing has a search box. It uses Postgres full-text search on the event name, venue, address, and city, with prefix matching on each word, plus a match on the organizer's name. | 2026-11-16 |
| Q6 | The cancel and change emails go to vendors with an active application (`submitted` or `approved`, which includes those with a slot). Withdrawn, declined, and removed vendors aren't emailed. | 2026-11-16 |
| Q7 | Canceling works from `open_to_vendors` or `announced`. Active assignments end as `canceled`, their payments and proofs are archived, and applications keep their status. Announcing works only from `open_to_vendors`, before the event ends, and not while it is hidden. Applications can stay open after announcing. | 2026-11-16 |
| Q8 | The change email is sent when the dates, hours, venue, address, or city change on an event that is open to vendors or announced, and shows the old and new values. | 2026-11-16 |

### D9. Editing an approved organizer's name and links (resolved 2026-11-13)

An approved organizer can edit everything on their organizer profile. Changing the display name, or adding a link the admin didn't review, sends them back to `pending_review`, and the "Approved by Creavent" badge hides until an admin approves again. Removing a link, and changing the page link, city, about, logo, or contact email, keep the approval. The links reviewed at each decision are kept in `user_roles.reviewed_links`. Onboarding still refuses these changes while a review is pending or after approval, because the profile page is where they are edited.

## Mockup fixes

Done on 2026-11-12 (L4). The mockup was updated to match the spec:
- Event cards already showed the "Approved by Creavent" badge (some as an icon-only seal). The earlier note that some were missing was wrong. The seals that had no screen-reader label now have one, and the calendar day panel shows the badge too.
- Two events now show multi-day: Pasalubong and Handmade Fair (Fri, Nov 20 to Sun, Nov 22) on the listing and calendar, and Lanang Holiday Flea (Fri, Dec 18 to Sun, Dec 20) on the vendor event page, where each slot covers all 3 days.
- The vendor event page uses the category name "Vintage", like onboarding and the seed list.
- The vendor picks the payment option they paid with when uploading proof, and the organizer's proof review shows it (L3).
- Event setup now has a Details tab (desktop and phone) with start and end date, daily opening and closing time, venue, vendor contact details, applications close date, and ingress details, and a Payments tab (desktop, with the existing phone screen updated) with payment options (GCash, Maya, bank transfer, other) and the deadline.

## Deferred with their features

Removed on 2026-11-09 because their features moved out of the MVP (see "Features to be implemented" in [Project details](project-details.md#features-to-be-implemented)). Bring them back when those features are built:
- Deposits, balance tracking: suggested to show the balance as information only, with a per-event fixed or percentage amount.
- Slot hold before the contract is signed: suggested that the same hold expiry applies.
- Contract changes after some vendors signed: suggested that signers keep their signed copy and new signers get the new one.
