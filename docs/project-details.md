# Creavent

## Description

Creavent is a web platform that brings vendor-based community events together in one place. Organizers plan and promote their events, vendors find events and secure spots, and attendees discover where to go and who will be there.

## Scope

- **Initial focus:** flea markets and flea market organizers. The MVP and early development are built around them, and the MVP is centered on organizers.
- **Future direction:** other vendor-based events such as bazaars, pop-ups, and similar gatherings.
- **Not in scope for now:** ticketed or paid entry for attendees. See the full out-of-scope list in the [Feature specification](feature-specification.md#9-out-of-scope-for-the-mvp).
- **MVP payments:** manual. Vendors pay organizers directly through any channel the organizer sets up (QR code, e-wallet, bank account) and upload proof of payment. Vendors pay the full slot price (no deposits). Organizers approve or reject the proof. There is no platform fee and no online payment integration. Refunds and disputes are handled between the two parties. See [Revenue model](revenue-model.md).
- **MVP contracts:** none. There is no contract upload or e-signature in the MVP. Each organizer writes a cancellation and withdrawal policy that is shown on the event page, and vendors accept it by applying. See [Features to be implemented](#features-to-be-implemented).
- **Name and domain:** "Creavent" is the final name. No domain is used during development. One is chosen later.
- **Launch area and language:** Davao City first. Currency is PHP (₱), time zone is Asia/Manila, and the interface is in English with simple wording. Other cities and languages (Filipino, Bisaya) come later.
- **Devices:** mobile-first for vendors and attendees. The organizer's floor plan editor is desktop-only, and organizers see the floor plan view-only on mobile.
- **MVP pricing:** the MVP is free for everyone. The terms of use say that fees may be introduced later with notice.
- **MVP notifications:** email, sent through Resend. Required emails (verification, payment, deadlines, changes) always send, and optional ones have an unsubscribe link. Messages also show an in-app unread indicator.
- **Hosting and files:** the web app, API, and database are hosted on Render. Uploaded files (event covers, vendor photos, proofs of payment, and documents) are stored in Cloudflare R2 through the S3 SDK. See [File uploads](feature-specification.md#11-file-uploads) and [Architecture](architecture.md).

The platform is described in general terms (events, organizers, vendors, attendees) so it can grow beyond flea markets later.

This page is a summary. The detailed behavior, rules, and open questions are in the [Feature specification](feature-specification.md).

## Roles and Features

### Admin

Keeps the platform trustworthy. Has full access to everything every other role can see and do, including proof of payment.

- Verify organizer and vendor accounts (target review time 1 to 2 business days). Organizer checks are strict, since they guard against fraud: legitimate documents, a valid ID, a matching selfie, and social media or past event history
- Re-review resubmissions and support emails from rejected users
- Suspend or reinstate accounts
- Remove events that break the rules
- Handle user reports

### Organizer

Plans, promotes, and runs events.

- Add the organizer role to their account and get verified (draft events are allowed before verification, but opening an event to vendors needs it). One account can be both an organizer and a vendor
- Create and manage events (draft, open to vendors, announced, completed, canceled). Fill and finalize the vendor list first, then announce the event to attendees
- Promote events through a public event page once announced
- Set vendor requirements (product categories, limits on similar vendors, required permits)
- Open vendor applications, then approve or decline them. There is no cap on applications
- Build a floor plan with slots of different sizes, walkways, and other areas, and publish it
- Choose a slot selection mode: open selection, category selection, or organizer assignment. Changing the mode later clears unpaid holds after a warning, and reserved slots block it
- Set slot pricing, per slot if needed (the full price is paid by the vendor)
- Publish payment instructions (any account or QR) and set the payment deadline (24 hours by default). The price and instructions are locked onto each slot when it is held
- Review proof of payment and approve or reject it. The deadline stops while proof waits for review, and a rejected vendor gets 12 hours to re-upload. A payment made in cash can be approved without proof, with a note
- Remove a vendor (for example, a cancellation). Their payment records are kept (archived) for both sides
- Write their own cancellation and withdrawal policy and show it on the event page
- Message vendors and keep the event page details up to date

### Vendor

Finds events to join and manages participation.

- Add the vendor role to their account, get verified, and create a profile
- Browse and search upcoming events
- View event requirements, then apply and submit permits. Withdraw an application before the organizer decides. Reapply after a decline (after a removal, only if the organizer allows it)
- View the floor plan and choose and hold a slot, or wait for the organizer to assign one. A vendor can hold only one slot per event (for now)
- Release a held slot, or message the organizer to withdraw after reserving
- Pay the organizer directly and upload proof of payment before the deadline
- Message the organizer
- Track applications, payments, and upcoming events
- Receive email notifications

### Attendee

Discovers events and plans visits. An account is optional.

- Browse upcoming announced events by date, filtered by location and date range
- View event details, the floor plan once the organizer publishes it (vendor names appear only on reserved slots), and the list of accepted vendors (reserved slots only)
- See verified organizers, and open an organizer's page (details, social links, upcoming and past events)
- See the latest event details
- Optionally sign in (Google, or email and password) to save events, or follow events and organizers and get an email when a followed organizer announces a new event
- Report an event or user (signed-in users only)
- Attendees cannot contact organizers in the MVP

## Features to be implemented

Planned for after the MVP is finished. They are deliberately left out of the MVP to keep it simple but effective. The MVP flow works without them: vendors pay organizers directly and upload proof of payment, and each organizer's cancellation and withdrawal policy is shown on the event page.

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
