# Creavent MVP Feature Specification

**Status:** Draft for MVP. The MVP is centered on organizers (flea market organizers first) and kept as simple as possible: features that are not needed to run a first event are deferred (section 9). For a short summary, see [Project details](project-details.md). For the payment approach, see [Revenue model](revenue-model.md).

Last updated: 2026-11-12

## 1. Roles and accounts

| Role | Account | Before they can work |
|---|---|---|
| Organizer | Required | Approved by an admin before opening an event to vendors (section 2.1) |
| Vendor | Required | Nothing extra. A vendor can apply right after creating a profile |
| Attendee | None in the MVP | Browses without an account |
| Admin | Internal (Creavent team) | n/a |

- **Signup:** users sign up with Google, or with an email and password (the email is verified at signup with a link sent to their inbox). Accounts are for vendors and organizers. Attendees browse events and event pages without an account (section 7).
- **No identity verification in the MVP.** Creavent does not collect government IDs or selfies. Identity verification may be added after the legal review (see [Legal](legal.md)).
- **Signup agreements:** at signup, every user accepts the terms of use and the privacy notice, and confirms they meet the minimum age (18 for now, pending legal review). Each acceptance is recorded with the document version. When the terms or privacy notice change, users accept the new version the next time they sign in.
- **Same email, same account:** signing in with Google using an email that already has an account opens that account. If that account's email was never verified, Google sign-in verifies it and removes the old password, so no one can claim someone else's email by signing up first.
- **One account, more than one role:** a person has one login and can add the vendor role, the organizer role, or both (many flea market organizers also sell at other markets). The user switches between the vendor and organizer dashboards.
- **Contact number:** required when adding either role. Organizers see the contact number of vendors who apply to their events, and vendors see the organizer's contact details for the event (section 8.2).
- Admins are created by the Creavent team, not through public signup.
- **Closing an account:** there is no self-serve option in the MVP. The user emails support, and the team deletes the account by hand: personal data is wiped and the account cannot come back. It is not done while the user has a slot assigned or reserved, or runs an event that is open to vendors or announced. Records that other people rely on (reports, audit logs, application documents and payment records until their retention ends) are kept. Details are in the [Data model](data-model.md#51-accounts-and-roles).
- Launch area: Davao City first. Currency is PHP (₱), time zone is Asia/Manila, and the interface is in English with simple wording.
- The MVP is free for everyone. The terms of use say that fees may be introduced later with notice.
- Users reach the Creavent team through a support email address shown in the app (footer, account pages, and approval emails).

## 2. Admin

The Creavent team is a small group of admins, all with the same full access. There are no admin levels in the MVP.

Admins keep the platform trustworthy and support users. An admin can view everything other roles can see, including events, applications, application documents, and proof-of-payment images. Admin actions are limited to the list below. Rare data fixes are done by the team directly in the database.

- Review organizer approval requests (section 2.1): approve, or reject with a reason shown to the user, and re-review after a resubmission
- Suspend or reinstate organizer and vendor accounts
- Hide an event that breaks platform rules, or show it again
- View and handle user reports (fake account, scam, inappropriate content)

The product category list, retention periods, deadlines, minimum age, support email, and the current terms and privacy versions are set in configuration and seed data, not from admin pages. Changing them needs a deploy, not a code change.

### 2.1 Organizer approval

Organizer approval replaces identity verification in the MVP. It is the main protection against fraud, because Creavent holds no money and vendors pay organizers directly (section 6). No documents are uploaded: the admin only reviews information the organizer already shows in public.

**The organizer gives:**
- Contact number and contact email (required)
- Links to their social media pages, and to past event posts where available (at least one link is required)

**The admin checks** that the pages and past events look genuine, and may message or call the organizer before deciding. The target review time is 1 to 2 business days.

Approval states (organizer role only): `not submitted` → `pending review` → `approved` | `rejected` (can resubmit). An organizer who is not approved can create draft events but cannot open them to vendors.

**"Approved by Creavent" badge:** shown on the organizer page, event pages, and event cards. Wherever it appears, it links to a short explanation: Creavent reviewed this organizer's public pages and past events. It is not a guarantee. There is no "verified" wording anywhere in the MVP.

**Suspended accounts:** a suspended user cannot sign in to manage events or applications. When an organizer with upcoming events is suspended, an admin hides those events and emails the affected vendors from the support address. There is no automatic freeze in the MVP.

**Appeals:** there is no separate appeal process. A rejected organizer resubmits with better links, or emails support to contest the decision. An admin re-reviews either way.

Notes:
- Payment disputes and refunds between organizers and vendors are not Creavent's responsibility (see section 6). Admin access is for support, moderation, and fraud reports.
- Admin decisions (approvals, suspensions, hidden events, reports) and each admin view of an application document or proof of payment are recorded in the audit log (who, what, when).

## 3. Organizer

### 3.1 Account and event setup
- Add the organizer role, fill in the organizer profile that feeds the public organizer page (section 7.1), and request approval (section 2.1).
- Create and manage events: name, date and time, location, description, cover image, contact details (shown to vendors, not to attendees)
- Event states: `draft` → `open to vendors` → `announced` → `completed`, or `canceled`
  - **Open to vendors:** signed-in vendors can find the event, apply, and pay for their assigned slot. Attendees cannot see it. This is when the organizer fills and finalizes the vendor list. Opening needs organizer approval.
  - **Announced:** the organizer chooses when to announce. The event appears in attendee discovery. Organizers are expected to finalize vendors before announcing.
  - Edit an open or announced event. Changes to date, time, or location notify applied and confirmed vendors by email.
  - Cancel an event. Applied and confirmed vendors are notified by email. Any refunds are handled between the organizer and vendors.
  - Completed events remain on the platform as past events.
- Event page, shared by link. Signed-in vendors can see it once the event is open to vendors. Attendees can see it once the event is announced.

### 3.2 Vendor requirements
- Set requirements per event: allowed product categories, limit on similar vendors per category, required permits or documents
- Requirements are shown only to signed-in vendors on the event page, so they can read them before applying. Attendees do not see them.
- The "limit on similar vendors" is shown to the organizer during review (for example, "Food: 4 of 5 accepted"). The organizer makes the final decision. The system does not auto-reject.

### 3.3 Applications
- Open and close vendor applications for an event
- Review each application with the vendor's profile, contact number, and uploaded permits and documents
- Approve or decline, with an optional note
- There is no cap on the number of applications. The organizer can close applications at any time. When all slots are taken, the organizer can still approve applications (for example, in case a slot opens).
- A declined vendor can reapply to the same event. A removed vendor can reapply only if the organizer allows it.
- Remove a vendor at any time (for example, an agreed cancellation, a withdrawal, or no payment by the deadline). See section 6.6.

### 3.4 Slots and floor plan
- **Slots are a list.** The organizer adds slots with a number (label), an optional size (for example, "2m x 2m"), and a price. There is no drawing tool in the MVP.
- Set slot pricing (one price for all slots, or a price per slot). A price change applies only to slots that are still open. Assigned and reserved slots keep the price they had when assigned (section 6.1).
- A slot that is `assigned` or `reserved` cannot be deleted or renamed. The organizer removes the vendor first (section 6.6).
- **Floor plan images.** The organizer uploads up to two images, made in any tool (Canva, a photo of a drawing, and so on):
  - **Vendor floor plan:** the layout with empty, numbered slots. Signed-in vendors see it while the event is open to vendors or announced, so they know where each slot is.
  - **Public floor plan:** the final layout with the vendors placed. Attendees see it once the event is announced. The organizer uploads it after finalizing vendors.
  - Both are optional. Slot numbers on the images should match the slot list, but the system does not check this.
- View the vendor list and slot availability at a glance (slot: open, assigned, reserved; payment: pending, submitted, approved, rejected, overdue)
- Everything works on phones, including uploading floor plan images (the product is mobile-first).

### 3.5 Payments
See section 6.

### 3.6 Communication
- There is no in-app messaging in the MVP (section 9). Vendors who applied see the organizer's contact details for the event, and the organizer sees each applicant's contact number (section 8.2).
- Update the event details on the event page. Changes to date, time, or location email applied and confirmed vendors (section 3.1).

### 3.7 Event policy
- Write the event's own cancellation and withdrawal policy (free text) and show it on the event page to signed-in vendors. The platform does not set these rules. See section 6.6.
- Vendors see the policy before applying. Applying means they have read it.
- Contracts and e-signatures are not in the MVP (see section 9).

## 4. Vendor

### 4.1 Account and profile
- Add the vendor role and a contact number. No approval or documents are needed.
- Create and manage a vendor profile: shop name, products, photos, product categories

### 4.2 Finding and applying to events
- Browse and search upcoming events that are open to vendors or announced
- View an event's requirements (categories, limits, permits) and policy before applying
- Apply to an event and upload the required permits or documents
- View application status: `submitted`, `approved`, `declined`, `removed`, `withdrawn`
- Withdraw an application while it is still `submitted` (not yet approved or declined). The organizer is emailed. After approval, the vendor contacts the organizer instead. A withdrawn vendor can apply again.
- Reapply after a decline. After removal, reapply only if the organizer allows it (section 3.3).

### 4.3 Slots
- Slots are assigned by the organizer (section 5). Vendors do not pick slots in the MVP.
- See the assigned slot's number, size, and price, and the vendor floor plan image if the organizer uploaded one
- If all slots are taken, there is no waitlist. The vendor can contact the organizer or check back later.
- Release an assigned slot before payment is approved (see section 6.6). After the slot is reserved, contact the organizer.

### 4.4 Payment
- View the organizer's payment instructions, the amount due, and the payment deadline
- Pay the organizer directly and upload proof of payment (section 6)
- View payment status

### 4.5 Participation
- Track upcoming events joined
- See the organizer's contact details for each event applied to
- Receive email notifications (section 8.1)

## 5. Slot assignment

The MVP has one way to fill slots: **the organizer assigns them.** Vendor self-selection (open selection and category selection) is a later feature (section 9).

1. The vendor applies, and the organizer approves the application.
2. The organizer sees the list of approved vendors without a slot and assigns each one to an open slot.
3. The vendor gets an email with the slot, the amount due, the payment instructions, and the deadline (section 6).

Rules:
- A vendor must have an approved application before being assigned a slot.
- A slot has these states: `open` → `assigned` → `reserved` (payment approved). It returns to `open` if the vendor releases it or is removed.
- A slot belongs to one vendor at a time.
- A vendor can have only one slot per event (for now). The slot has its own payment amount, deadline, and proof of payment.
- There is no "move" feature. To change a vendor's slot, the organizer removes the vendor from the slot, which returns it to `open`, and then assigns another.
- No waitlist: when no slots are open, approved vendors simply have no slot. The organizer sees them in the "approved, no slot" list and can assign them if a slot opens.
- Assignment works the same before and after the event is announced.

## 6. Payments (manual, outside the platform)

Creavent does not process, hold, or refund money. The organizer and vendor handle payment and any disputes between themselves.

### 6.1 Organizer setup (per event)
- **Payment instructions:** free-form. The organizer can enter any account or channel (GCash, bank, Maya, other) and upload a QR code image, add account name and number, and add notes. There is no restriction to GCash or bank.
- **Price:** vendors pay the **full slot price**. Deposits are not in the MVP (see section 9).
- **Payment deadline:** default is **24 hours** from when the slot is assigned. The organizer can set a different number of hours for the event. The deadline never runs past the event start.
- Payment instructions are shown to a vendor right after they are assigned a slot.
- **Locked at assignment:** when a slot is assigned, its price and the payment instructions are copied onto the assignment. If the organizer later changes the price or the payment details, only new assignments use the new values. A vendor who already has a slot always sees the amount and account they were given.

### 6.2 Vendor flow
1. Receive a slot. The deadline is shown ("Pay by Sat, 3 Jan, 6:00 PM").
2. See the amount due, the instructions, and the deadline.
3. Pay outside the platform and upload proof of payment (image).
4. Wait for the organizer's decision.

### 6.3 Organizer review
- Review the proof image against the amount due
- Approve → slot becomes `reserved`
- Reject, with a reason → the vendor can upload new proof. The reason should say what to fix (for example, "short by ₱100" or "screenshot is unreadable").
- **Approve without proof:** the organizer can mark a payment as approved without a proof image (for example, cash paid on site, or paid by someone else), with a required note such as "Paid cash at the office". The slot becomes `reserved`.
- Track which vendors have paid

### 6.4 Payment statuses and the deadline
`pending` (no proof yet) → `submitted` (proof uploaded) → `approved` | `rejected`.
- **The deadline is shown, not enforced.** Nothing expires on its own. When the deadline passes and the payment is still `pending` or `rejected`, the organizer sees it marked **Overdue**. The organizer decides what to do: wait, or remove the vendor (section 6.6), which returns the slot to `open`.
- There are no reminder emails, retry windows, or deadline extensions in the MVP. An organizer who wants to give more time simply does not remove the vendor.

### 6.5 Visibility
Proof-of-payment images are visible to the vendor who uploaded them, the organizer of that event, and admins. No one else can see them.

### 6.6 Cancellations, withdrawals, and removal
Cancellation and withdrawal rules (refunds, notice periods) are decided by each organizer and written in their event policy. Creavent does not set or enforce them. The platform only provides a way to release a slot and a way to remove a vendor.

- **Release a slot:** a vendor whose slot is assigned (payment not yet approved) can always release it. Organizers cannot turn this off. The slot returns to `open` and the organizer is notified by email.
- **After the slot is reserved:** the vendor contacts the organizer using the contact details on the event. The organizer decides under their own policy.
- **Organizer removes a vendor:** the organizer can remove a vendor from an event at any time, for example when a withdrawal is agreed, a vendor cancels, or a payment is overdue. The slot returns to `open` and the vendor is notified by email.
- **Records are kept on removal:** removing a vendor does not delete their proof-of-payment files. They are marked as archived and become read-only. The vendor, the organizer, and admins can still view and download them, so either side has evidence if a dispute comes up. See retention in section 6.7.
- Refunds and any disputes are handled by the organizer and vendor directly. Creavent has no role in them.
- The platform shows a short notice to both sides saying that payments happen outside Creavent.
- **Fraud notice:** when a vendor is shown payment instructions, the notice also says that Creavent does not hold or guarantee payments, and that vendors should check that the organizer is "Approved by Creavent" and look at their past events before paying. Vendors can report an organizer with the report button (section 7), and admins can suspend reported organizers. A dedicated "report a scam" process is a later feature.

### 6.7 Data to store
Amount due, amount paid, status, payer, payee, proof image, organizer's decision and reason, and timestamps. Fee fields (platform fee, who pays, processing cost) are kept in the data model but unused. See [Revenue model](revenue-model.md) §7.

**Retention:** payment records are kept for 90 days after the event date (or, for events that never took place, 90 days after the event was canceled), then permanently deleted. This covers the proof-of-payment images, the payment records themselves (amounts, statuses, decisions), the payment QR images, the payment instructions copied onto each assignment, and the application documents (permits) of that event. The record of which vendor had which slot is kept. Archived records from removed vendors follow the same schedule. The 90 days is a default set in configuration. The vendor and organizer are told about this in the terms of use. Confirm with a lawyer how long records should be kept under the Philippine Data Privacy Act.

## 7. Attendee

Attendees do not have accounts in the MVP.

- Browse upcoming announced events, sorted by date (soonest first), and filter by location and date range. Events that are only open to vendors are not shown.
- View an event page: schedule, location, description, organizer, and the public floor plan image (once the organizer uploads it and the event is announced)
- See the list of accepted vendors on the event page (vendors with a `reserved` slot only)
- See the "Approved by Creavent" badge on organizers
- See changes to event details on the event page
- Attendees cannot contact organizers. There is no attendee messaging or contact form in the MVP.
- **Reports:** signed-in vendors and organizers can report an event or user with a report button. Attendees report through the support email address shown on every page.

### 7.1 Organizer page

Every organizer has a public page (`/organizers/<slug>`) that helps attendees and vendors get to know them:
- Display name, logo, "Approved by Creavent" badge, about text, city, social media links, and when they joined Creavent
- Upcoming announced events and past (completed) events
- Number of events held on Creavent
- Report button (signed-in users)

The organizer edits it from their organizer profile. There is no contact form. The page is not shown while the organizer is suspended or deleted. Pages are listed in the [Sitemap](sitemap.md).

Not included in the MVP: public vendor pages or catalogs, and a vendor directory. The accepted-vendor list and the public floor plan image are the only public places vendors appear.

## 8. Notifications and contact

### 8.1 Email notifications
All notifications are sent by email through [Resend](https://resend.com). There are no push or SMS notifications in the MVP. Every email in the MVP is required and always sends. There are no optional emails, so there is no unsubscribe link.

- **Email address checks:** the email is verified at signup. Bounced emails are not tracked in the MVP.
- The sending domain and sender name are decided when the domain is bought (see [Open questions](open-questions.md)).

| Trigger | Recipient |
|---|---|
| Signup, or a new email address (link to verify it) | User |
| Forgot password (reset link) | User |
| Organizer approved or rejected | Organizer |
| New application submitted | Organizer |
| Application withdrawn by the vendor | Organizer |
| Application approved or declined | Vendor |
| Slot assigned | Vendor (includes payment instructions and deadline) |
| Vendor released an assigned slot | Organizer |
| Proof of payment uploaded | Organizer |
| Payment approved or rejected | Vendor (a rejection includes the reason) |
| Vendor removed from event | Vendor |
| Event canceled, or date, time, or location changed | Applied and confirmed vendors |

### 8.2 Contact between organizers and vendors
- There is no in-app messaging in the MVP. Organizers and vendors talk outside Creavent (phone, SMS, Messenger).
- Signed-in vendors see the organizer's contact details for the event (`vendor contact details` on the event, section 3.1). Attendees never see them.
- The organizer sees the contact number of each vendor who applied to their event.

## 9. Out of scope for the MVP

- Identity verification (government ID, selfie) for organizers and vendors. Replaced by organizer approval (section 2.1) until the legal review is done
- Vendor slot selection (open selection, category selection). The organizer assigns all slots
- Floor plan editor (drawing slots, walkways, and areas). Replaced by uploaded floor plan images
- Payment deadline enforcement: automatic expiry, reminder emails, retry windows, and deadline extensions
- In-app messaging between organizers and vendors
- Attendee accounts: saving events, following events and organizers, and their emails
- Admin "view as this user", acting on behalf of users, and admin pages for categories and settings
- Automatic freeze of a suspended organizer's events
- Self-serve account deactivation and deletion
- HEIC uploads and multiple image sizes
- Bounced-email tracking
- Ticketed or paid entry for attendees
- Online payment integration, platform fees, and refunds handled by the platform
- Waitlist for full events
- Deposit option (full slot price only)
- Event announcements (an updates section on the event page, or emails to vendors)
- Contract upload and e-signature (see "Features to be implemented" in [Project details](project-details.md#features-to-be-implemented))
- Recruiting vendors by browsing or inviting from a vendor directory
- Public vendor pages, catalogs, or directories
- Attendee messaging or contact forms to reach organizers
- Organizer analytics and platform success dashboards (page views, follows, conversion)
- Ratings and reviews
- Push and SMS notifications
- Recurring events and event series
- Multi-day events with day-specific slots

## 10. Decisions and open questions

### Decided
- **MVP simplification (2026-11-12):** identity verification, vendor slot selection, the floor plan editor, deadline enforcement, messaging, attendee accounts, admin extras, the automatic freeze, self-serve account closing, HEIC, multiple image sizes, and bounce tracking are deferred (section 9).
- Organizers are approved by an admin from their social media and past event links. No documents are uploaded. Vendors need no approval (section 2.1).
- The badge reads "Approved by Creavent" and links to what it means. No "verified" wording.
- Vendors upload permits and documents when applying. Requirements are shown only to signed-in vendors.
- Slots are a list, filled only by organizer assignment. Floor plans are two optional images: one for vendors (empty slots) and one for attendees (vendors placed).
- Payment deadlines are shown, not enforced. Overdue payments are flagged, and the organizer removes the vendor if needed.
- Admins have full view access, including proof of payment and application documents.
- Waitlist, deposit option, and event announcements are moved out of the MVP.
- Contract signing is moved out of the MVP. Vendors accept the organizer's event policy by applying.
- Online payment integration stays out of the MVP. Payments are manual with proof upload.
- Application approval is required before a vendor can be assigned a slot.
- The default payment deadline is 24 hours, and organizers can change it.
- Withdrawal and cancellation rules are set by each organizer. The platform only provides release, removal, and contact details.
- Vendors can always release an assigned slot before payment is approved. Organizers cannot turn this off.
- Removing a vendor does not delete their proof of payment. Records are archived, readable by both sides and admins, and deleted 90 days after the event.
- A vendor can have only one slot per event (for now).
- Slots can have different sizes and prices.
- No slot-move feature. To change slots, the organizer removes and reassigns.
- No cap on applications. When slots are full, the organizer can still approve applications.
- Declined vendors can reapply. Removed vendors can reapply only if the organizer allows it.
- The accepted-vendors list shows reserved vendors only.
- The event listing is sorted by date, with filters by location and date.
- Users sign in with Google, or with an email and password. No magic links.
- Only signed-in users (vendors and organizers) can report a user or event. Attendees use the support email.
- Attendees cannot contact organizers in the MVP.
- The admin team is small, all with full access, and admin decisions are logged. No admin levels.
- Organizers who are not approved can draft events but not open them to vendors. The target review time is 1 to 2 business days.
- Rejected organizers resubmit or email support. There is no separate appeal process.
- Support is a support email address shown in the app.
- Launch area is Davao City (PHP, Asia/Manila, English). The MVP is free for everyone, and the terms say fees may be introduced later with notice.
- The whole product is mobile-first, including for organizers.
- All emails in the MVP are required. There are no optional emails.
- Emails are verified at signup.
- Fraud stance: a clear notice when payment instructions are shown, organizer approval from public pages and past events, and the report button. A dedicated scam-report process comes later.
- Price and payment instructions are locked onto a slot when it is assigned. Assigned and reserved slots cannot be deleted or renamed.
- Events go `draft` → `open to vendors` → `announced`. Organizers finalize vendors before announcing to attendees.
- No payment deadline runs past the event start.
- A suspended organizer's upcoming events are hidden by an admin, who emails affected vendors.
- One account can hold the vendor role, the organizer role, or both.
- Files are stored in Cloudflare R2 through the S3 SDK, and the API on Render handles every upload (section 11). Event covers, organizer logos, avatars, vendor photos, and floor plan images are public. Proofs of payment, payment QR codes, and application documents are private.
- Browsers upload straight to storage with short-lived signed URLs. The API checks and re-encodes every file before it is used. Originals are not kept.
- Images accepted: JPEG, PNG, and WebP. Documents may also be PDF. Maximum size is 5 or 10 MB depending on the purpose (section 11.1). Event covers are 16:9.
- No virus scanning in the MVP. PDFs are only allowed in private purposes and are served as downloads.
- Organizers can approve a payment without a proof image, with a required note (for example, cash on site).
- Vendors can withdraw an application while it is still `submitted`.
- Users close their account by emailing support (section 1).
- Payment records, proofs, payment QR images, and application documents are deleted 90 days after the event.
- Changes to event date, time, or location are not kept as a history. They only send emails.
- The technical setup is in [Architecture](architecture.md).
- Every organizer has a public organizer page (section 7.1).
- Users accept the terms and privacy notice and confirm the minimum age at signup. Acceptances are recorded per version (section 1).

### Open
1. Confirm the record retention period (90 days) and data handling with a lawyer under the Philippine Data Privacy Act, including health certificates uploaded as permits.

## 11. File uploads

Every upload follows the same rules. The tables behind it are in the [Data model](data-model.md#52-files).

### 11.1 What can be uploaded

"Image" means a still JPEG, PNG, or WebP photo. HEIC, GIF, SVG, and animated files are not accepted. Logos and avatars are not described elsewhere in this spec, so this table is where they are defined.

| Purpose | Used for | Uploaded by | Who can open it | Types | Max size | Limit |
|---|---|---|---|---|---|---|
| Event cover | Banner and card image of an event (3.1) | The event's organizer | Anyone (public) | Image | 10 MB | 1 per event |
| Organizer logo | Organizer's public profile (3.1) | The organizer | Anyone (public) | Image | 5 MB | 1 |
| Avatar | A user's picture | The user | Anyone (public) | Image | 5 MB | 1 |
| Vendor photo | Vendor profile (4.1) | The vendor | Anyone (public) | Image | 10 MB | 8 per profile |
| Vendor floor plan | Layout with empty slots (3.4) | The event's organizer | Anyone (public), shown to signed-in vendors only | Image | 10 MB | 1 per event |
| Public floor plan | Layout with vendors placed (3.4) | The event's organizer | Anyone (public), shown once the event is announced | Image | 10 MB | 1 per event |
| Payment QR | Payment instructions (6.1) | The event's organizer | The organizer, vendors with a slot at the event, admins | Image | 5 MB | 1 per payment method |
| Proof of payment | Payment proof (6.2) | The vendor with the slot | The vendor, the event's organizer, admins | Image | 10 MB | 1 per proof |
| Application document | Event permits and documents (3.2, 4.2) | The applying vendor | The vendor, the event's organizer, admins | Image or PDF | 10 MB | 3 per requirement |

Minimum size: event covers must be at least 1280 x 720 px. Logos and avatars must be at least 256 x 256 px.

"Public" means anyone with the file's web address can open it. The app shows these files only where they belong, and addresses are random and cannot be guessed. Hiding an event does not hide its cover's or floor plans' addresses. This is accepted for the MVP, because these images hold no private data.

### 11.2 Storage

- Files live in Cloudflare R2, used through the S3 SDK. Only the server (the API and its background worker, hosted on Render) holds the R2 credentials. Browsers never see them.
- There are two buckets per environment (development, staging, production never share one): a **public** bucket for the public purposes, served from a custom domain behind Cloudflare's CDN, and a **private** bucket for everything else, with no public access.
- Names and paths are random. A file's path is its purpose and a random id. It never contains a user's name, an email, an event name, or the uploaded file name.
- Unchecked uploads never go to the public bucket. They land in an `incoming/` area of the private bucket first (section 11.3).

### 11.3 Upload flow

1. **Ask.** The app tells the API the purpose, file type, and size. The API checks that the user is allowed to upload this kind of file here (for example, only the organizer of the event can upload its cover), that the type, size, and count limits hold, and that the user is not over the rate limit. It creates a file record as `pending` and returns a signed upload address that expires in 5 minutes and accepts only the declared type and size.
2. **Upload.** The browser sends the file straight to the `incoming/` area of the private bucket.
3. **Complete.** The browser tells the API it is done. The API reads the uploaded file, runs the checks and processing in sections 11.4 and 11.5, writes the final file to the right bucket, deletes the `incoming/` copy, and marks the record `ready`. If any check fails, the record and the upload are deleted and the user sees a clear reason (for example, "This file is over 10 MB" or "This photo is too small. Use at least 1280 x 720").
4. **Attach.** A file can be attached to an event, profile, application, or payment only when it is `ready`, only to a place that matches its purpose, and only by the user who uploaded it.

A user can have at most 20 `pending` uploads at a time, and upload requests are rate limited per user. Abandoned uploads are cleaned up (section 11.7).

### 11.4 Checks

The browser also checks type and size first, so mistakes show up early. Those checks are only for convenience. The API repeats and enforces all of these:

- **Type:** the real type is read from the file's first bytes and must be on the purpose's allowed list. The type the browser claimed must match. File extensions are ignored.
- **Size:** the uploaded size must be within the purpose's limit (11.1).
- **Images:** the file must decode as a real image and be no larger than 50 megapixels (a guard against files built to exhaust memory), and meet the minimum size for its purpose.
- **PDFs:** the file must start with the PDF signature and be within the size limit. PDFs are not rewritten.

### 11.5 Processing

Every image is re-encoded as WebP, which removes hidden data such as the GPS location in phone photos and makes sure what is stored is a clean image. Originals are not kept. Phone photos are rotated upright first.

Each image is stored in one size:

| Purpose | Stored size |
|---|---|
| Event cover | 1600 x 900, cropped to 16:9 from the center |
| Vendor photo | Up to 1600 px on the long edge, shape kept |
| Organizer logo | Fits inside 512 x 512, no cropping |
| Avatar | 256 x 256, cropped square |
| Floor plans and private images (proof of payment, payment QR, application images) | Up to 2400 px on the long edge, shape kept, so text and slot numbers stay readable |

PDFs are stored as uploaded. Images are never enlarged. A smaller image is stored at its own size. Smaller sizes for faster pages are a later improvement.

Processing runs while the browser waits for the Complete step. The API limits how many images it processes at once so a busy moment cannot run it out of memory.

### 11.6 Viewing and downloading

- **Public files:** the app uses the file's web address on the public domain. Each address is unique to one upload and is cached for a long time, so replacing a picture just creates a new address.
- **Private files:** the app asks the API, which checks that the person may open the file (section 11.1) and sends them to a signed address that expires in 5 minutes. Addresses are never stored or shared, and every view gets a new one. PDFs always download instead of opening in the page.
- Downloads are named from the file's purpose and date, not from the original file name.

### 11.7 Replacing, removing, and cleanup

- **Replacing** a picture (cover, logo, avatar, floor plan) creates a new file and removes the old one. Removing a vendor photo removes that file.
- A removed file is deleted from storage within 24 hours.
- Uploads that never reach Complete are deleted automatically after 24 hours.
- Proof-of-payment, payment QR, and application document files follow the retention rules in section 6.7. When an account is deleted, its avatar is removed.

### 11.8 Not in the MVP

Virus scanning, keeping original files, HEIC, multiple sizes per image, a crop tool beyond the automatic center crop, video, and GIF or animated images.
