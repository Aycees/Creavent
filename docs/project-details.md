# Creavent

Last updated: 2026-11-14

## Description

Creavent is a web platform that brings vendor-based community events together in one place. Organizers plan and promote their events, vendors find events and secure spots, and attendees discover where to go and who will be there.

## Scope

- **Initial focus:** flea markets and flea market organizers. The MVP and early development are built around them, and the MVP is centered on organizers.
- **Event types:** events are general. Each event has one type, and the initial list is Flea market, Bazaar, and Pop-up. Flea markets stay the focus (the default type). The list is managed in seed data, so more types can be added later. See [Feature specification §3.1](feature-specification.md#31-account-and-event-setup).
- **Future direction:** other vendor-based events and gatherings beyond these three types.
- **Not in scope for now:** ticketed or paid entry for attendees. See the full out-of-scope list in the [Feature specification](feature-specification.md#9-out-of-scope-for-the-mvp).
- **MVP payments:** manual. Vendors pay organizers directly through any channel the organizer sets up (QR code, e-wallet, bank account) and upload proof of payment. Vendors pay the full slot price (no deposits). Organizers approve or reject the proof. There is no platform fee and no online payment integration. Refunds and disputes are handled between the two parties. See [Revenue model](revenue-model.md).
- **MVP contracts:** none. There is no contract upload or e-signature in the MVP. Each organizer writes a cancellation and withdrawal policy that is shown on the event page, and vendors accept it by applying. See [Features to be implemented](#features-to-be-implemented).
- **Name and domain:** "Creavent" is the final name. No domain is used during development. One is chosen later.
- **Launch area and language:** Davao City first. Currency is PHP (₱), time zone is Asia/Manila, and the interface is in English with simple wording. Other cities and languages (Filipino, Bisaya) come later.
- **Devices:** mobile-first for everyone, including organizers. There is no floor plan editor: organizers upload floor plan images.
- **MVP pricing:** the MVP is free for everyone. The terms of use say that fees may be introduced later with notice.
- **MVP notifications:** email only, sent through Resend. Every MVP email is required (account, approval, application, payment, and event changes). There is no in-app messaging: organizers and vendors see each other's contact details.
- **MVP trust:** no identity verification (no IDs or selfies). Admins approve organizers from their social media and past event links, and approved organizers show an "Approved by Creavent" badge. Vendors need no approval.
- **Hosting and files:** the web app, API, and database are hosted on Render. Uploaded files (event covers, floor plan images, vendor photos, proofs of payment, and permits) are stored in Cloudflare R2 through the S3 SDK. See [File uploads](feature-specification.md#11-file-uploads) and [Architecture](architecture.md).

The platform is described in general terms (events, organizers, vendors, attendees) so it can grow beyond flea markets later.

## Brand

- **Logo direction (chosen 2026-11-12): Market grid.** A 3 x 3 grid of small squares, with the center square in ember and the last square outlined. It sits next to a lowercase "creavent" wordmark in Geist.
- This mark replaces the design system's earlier "no other symbol" rule.
- Colors, typography, components, and the rest of the design system are in the [Design brief](design-brief.md).

This page is a summary. The detailed behavior, rules, and open questions are in the [Feature specification](feature-specification.md).

## Roles and Features

### Admin

Keeps the platform trustworthy. Can view everything other roles can see, including proof of payment and permits.

- Approve organizers from their social media and past event links (target review time 1 to 2 business days)
- Re-review resubmissions and support emails from rejected organizers
- Suspend or reinstate a user's vendor or organizer role, with a reason shown to the user
- Hide events that break the rules, with a reason emailed to the organizer
- Handle user reports from the report button and the support inbox

### Organizer

Plans, promotes, and runs events.

- Add the organizer role to their account through a 4-step onboarding, and get approved (draft events are allowed before approval, but opening an event to vendors needs it). One account can be both an organizer and a vendor
- Create and manage events (draft, open to vendors, announced, completed, canceled), and pick an event type for each (Flea market by default). Fill and finalize the vendor list first, then announce the event to attendees
- See to-do counts per event on a dashboard: applications to review, proofs to check, overdue payments, and approved vendors with no slot
- Promote events through a public event page once announced
- Set vendor requirements (product categories, limits on similar vendors, required permits). Requirements are shown only to signed-in vendors
- Open vendor applications (with an optional close date), then approve or decline them. There is no cap on applications
- Add slots as a list (section, number, size, note, price), a row at a time if needed, and assign approved vendors to them. Optionally let vendors choose a preferred slot when they apply (the organizer still assigns)
- Upload two floor plan images: one with empty slots for vendors (also shown as a reference while adding slots), and one with vendors placed for attendees
- Set slot pricing, per slot if needed (the full price is paid by the vendor)
- Publish payment instructions (any account or QR) and set the payment deadline (24 hours by default). The price and instructions are locked onto each slot when it is assigned. Overdue payments are flagged, not expired automatically
- Review proof of payment and approve or reject it. A payment made in cash can be approved without proof, with a note
- Remove a vendor (for example, a cancellation or an overdue payment). Their payment records are kept (archived) for both sides
- Write their own cancellation and withdrawal policy and show it to vendors on the event page. Each new event starts with the policy from their last event
- Keep the event page details up to date

### Vendor

Finds events to join and manages participation.

- Add the vendor role to their account through a 4-step onboarding and create a profile. No approval needed
- Have a public vendor page (shop details, photos, social media links, the next event, and where they've sold), so attendees can get to know them. Phone number and email are never public
- Browse and search upcoming events, and see how many spots remain in their category
- View event requirements, then apply and upload permits. Withdraw an application before the organizer decides. Reapply after a decline (after a removal, only if the organizer allows it)
- Get a slot assigned by the organizer, and choose a preferred slot when the organizer allows it. A vendor can have only one slot per event (for now)
- Release an assigned slot before payment is approved, or contact the organizer to withdraw after reserving
- Pay the organizer directly and upload proof of payment before the deadline
- See the organizer's contact details for each event
- Track applications, payments, and upcoming events
- Receive email notifications

### Attendee

Discovers events and plans visits. No account in the MVP.

- Browse upcoming announced events by date in a list or a calendar, filtered by event type, location, and date range
- View event details, the public floor plan image once the event is announced, and the list of accepted vendors (reserved slots only)
- See organizers "Approved by Creavent", and open an organizer's page (details, social links, upcoming and past events)
- Open a vendor's page from the accepted-vendor list. There is no vendor directory or search
- See the latest event details
- Report an event or user through the support email
- Attendees cannot contact organizers in the MVP

## Features to be implemented

Planned for after the MVP is finished. They are deliberately left out of the MVP to keep it simple but effective. The MVP flow works without them: vendors pay organizers directly and upload proof of payment, and each organizer's cancellation and withdrawal policy is shown on the event page.

### Deferred to keep the MVP simple

Decided on 2026-11-12. Each can be added once users ask for it:

- **Identity verification:** government ID and selfie checks for organizers and vendors, after the legal review. Until then, organizers are approved from public links
- **Vendor slot selection:** vendors pick and hold an open slot (open selection), or one matching their category (category selection)
- **Floor plan editor:** draw slots, walkways, and areas, with vendor names shown on reserved slots
- **Payment deadline enforcement:** automatic expiry of unpaid slots, reminder emails, retry windows after a rejected proof, and deadline extensions
- **In-app messaging** between organizers and vendors, with unread indicators
- **Attendee accounts:** save events, follow events and organizers, and get emails when a followed organizer announces an event
- **Admin tools:** "view as this user", acting on behalf of users, and admin pages for categories and settings
- **Automatic freeze** of a suspended organizer's events
- **Self-serve account deactivation and deletion**
- **HEIC uploads, multiple image sizes, and bounced-email tracking**

### Waitlist

- When slots are full, approved vendors can join a waitlist (per category when slots have categories)
- When a slot opens, it is offered to the first waitlisted vendor, who gets it on hold with a normal payment deadline
- If they decline or the hold expires, it goes to the next vendor, and each vendor is notified by email

### Deposit option

- Organizers can accept a deposit (fixed amount or percentage of the slot price) instead of the full price
- The slot becomes reserved once the deposit is approved
- The remaining balance is tracked as information, and collection happens outside the platform

### Event announcements

- Organizers post updates in a section on the public event page
- Announcements can also be emailed to confirmed vendors, and to attendees who follow the event

### Contract signing

- Organizers upload a contract or agreement (for example, a PDF) for an event and send it to vendors
- Vendors review and sign it with an e-signature (typed name and drawn signature)
- Organizers track which vendors have signed and view each signed contract with the signature and signing date
- Vendors sign before paying: payment instructions and the proof upload unlock only after signing
- The payment deadline covers both signing and paying
- Organizers can replace a contract after some vendors have signed. Vendors who signed keep their signed copy
- Contracts and signatures are stored and archived like proof-of-payment records
- Needs legal confirmation that this kind of e-signature is acceptable under the Philippine E-Commerce Act

### Online payment integration

- Vendors pay through the platform with an online payment provider (for example, PayMongo), instead of uploading proof of payment
- Payments are confirmed automatically, so organizers no longer approve or reject proof by hand
- Platform fees, payouts to organizers, and refunds handled by the platform
- Needs the final revenue model, plus tax (VAT) and fund-holding checks with a local accountant and lawyer

See [Revenue model](revenue-model.md) for the candidate revenue strategies and the [Feature specification](feature-specification.md#9-out-of-scope-for-the-mvp) for the full out-of-scope list.
