# Creavent MVP Feature Specification

**Status:** Draft for MVP. The MVP is centered on organizers (flea market organizers first). For a short summary, see [Project details](project-details.md). For the payment approach, see [Revenue model](revenue-model.md).

Last updated: 2026-11-12

## 1. Roles and accounts

| Role | Account | Verification |
|---|---|---|
| Organizer | Required | Required before opening an event to vendors |
| Vendor | Required | Required before applying to an event |
| Attendee | Optional | None |
| Admin | Internal (Creavent team) | n/a |

- Attendees can browse events and event pages without an account. An account is only needed to save or follow events and organizers, or to report an event or user. Users sign in with Google, or with an email and password (the email is verified at signup).
- **Signup agreements:** at signup, every user accepts the terms of use and the privacy notice, and confirms they meet the minimum age (18 for now, pending legal review, see [Legal](legal.md)). Each acceptance is recorded with the document version. When the terms or privacy notice change, users accept the new version the next time they sign in.
- **Same email, same account:** signing in with Google using an email that already has an account opens that account. If that account's email was never verified, Google sign-in verifies it and removes the old password, so no one can claim someone else's email by signing up first.
- **One account, more than one role:** a person has one login and can add the vendor role, the organizer role, or both (many flea market organizers also sell at other markets). Each role has its own verification state, and the user switches between the vendor and organizer dashboards. An approved vendor ID check counts toward organizer verification, so an organizer only adds the extra documents (section 2.1).
- Admins are created by the Creavent team, not through public signup.
- **Closing an account:** a user can **deactivate** (hidden, and signing in again brings the account back) or **delete** (personal data is wiped and the account cannot come back). Neither is allowed while the user has a slot on hold or reserved, or runs an event that is open to vendors or announced. Records that other people rely on (sent messages, reports, audit logs, verification documents, payment records until their retention ends) are kept. Details are in the [Data model](data-model.md#51-accounts-roles-and-verification).
- Launch area: Davao City first. Currency is PHP (₱), time zone is Asia/Manila, and the interface is in English with simple wording.
- The MVP is free for everyone. The terms of use say that fees may be introduced later with notice.
- Users reach the Creavent team through a support email address shown in the app (footer, account pages, and verification emails).

## 2. Admin

The Creavent team is a small group of admins, all with the same full access. There are no admin levels in the MVP.

Admins keep the platform trustworthy and support users. An admin has access to everything every other role can see and do, including organizer, vendor, and attendee features, and can act on behalf of users when needed (for example, to help fix a problem for a user). Admins make changes from admin pages. They can also open a read-only "view as this user" to see what the user sees, but cannot act inside it. Opening it is logged.

- Review the verification queue for organizers and vendors
  - View submitted ID, business permit, or other documents
  - Approve or reject, with a reason shown to the user
  - Re-review after a user resubmits
- Suspend or reinstate organizer and vendor accounts
- Remove or hide an event that violates platform rules
- View and manage user reports (fake account, scam, inappropriate content). Only logged-in users can submit a report.
- Full access to all organizer, vendor, and attendee features and data
  - Includes events, applications, floor plans, messages, and payments
  - Includes viewing proof-of-payment images
- Maintain the platform-wide product category list (add, rename, reorder, turn off). Categories are never deleted, because old events point to them.
- Change platform settings (retention periods, deadlines, reminder timing, minimum age, support email, current terms and privacy versions)

### 2.1 Verification requirements
Recommended documents. Admins review each submission and may ask for more. The target review time is 1 to 2 business days.

**Organizer**

Organizer verification is the main protection against fraud, because Creavent holds no money and vendors pay organizers directly (section 6). Admins check that the documents are legitimate and the ID is valid, that the face in the selfie matches the ID, and, where available, that the organizer's social media pages and past successful events look genuine.
- A valid government-issued ID (required), plus a selfie holding the ID
- Contact number and email (required)
- One proof of operation (required, any one of): business permit, DTI or SEC registration, or links to social media pages or past event posts showing prior events (many flea market organizers are informal)
- Events held at a venue may need a venue permission or permit. This is the organizer's responsibility and is not checked at verification.

**Vendor**
- A valid government-issued ID (required)
- Contact number (required)
- A business permit or DTI registration is optional at account level, because many flea market vendors are informal. Organizers set permit requirements per event (section 3.2), and vendors submit them when applying (for example, a sanitary permit or health certificate for food vendors).

Verification states (one per role): `unverified` → `pending review` → `verified` | `rejected` (can resubmit). Suspended accounts cannot log in to manage events or applications.

**Suspended organizer with live events:** when an admin suspends an organizer, each of their upcoming events is hidden from the public and frozen. No new applications, holds, proof uploads, or approvals can happen. Vendors who applied or hold or reserved a slot get an email with the support address, and they can still view and download their payment records. An admin then either reinstates the event (when the organizer is reinstated) or cancels it, which sends the normal cancellation emails (section 8.1).

**Appeals:** there is no separate appeal process. A rejected user resubmits with new documents, or emails support to contest the decision. An admin re-reviews either way.

Notes:
- Payment disputes and refunds between organizers and vendors are still not Creavent's responsibility (see section 6). Admin access is for support, moderation, and fraud reports.
- Admin actions on behalf of a user should be recorded (who, what, when) so they can be audited. Each time an admin opens a verification document (ID, selfie, permit), that view is recorded too.

## 3. Organizer

### 3.1 Account and event setup
- Create an organizer account, fill in the organizer profile that feeds the public organizer page (section 7.1), and submit documents for verification (see section 2.1). An unverified organizer can create draft events but cannot open them to vendors until verified.
- Create and manage events: name, date and time, location, description, cover image, contact details (shown to vendors, not to attendees)
- Event states: `draft` → `open to vendors` → `announced` → `completed`, or `canceled`
  - **Open to vendors:** vendors can find the event, apply, hold or be assigned slots, and pay. Attendees cannot see it. This is when the organizer fills and finalizes the vendor list.
  - **Announced:** the organizer chooses when to announce. The event appears in attendee discovery, and attendees who follow the organizer are emailed. Organizers are expected to finalize vendors before announcing. After this point, vendors can no longer pick slots themselves (section 5).
  - Edit an open or announced event. Changes to date, time, or location notify applied and confirmed vendors by email, plus following attendees once the event is announced.
  - Cancel an event. Applied and confirmed vendors (and following attendees, if announced) are notified by email. Any refunds are handled between the organizer and vendors.
  - Completed events remain on the platform as past events.
- Event page, shared by link. Vendors can see it once the event is open to vendors. It is listed in attendee discovery once the event is announced.

### 3.2 Vendor requirements
- Set requirements per event: allowed product categories, limit on similar vendors per category, required permits or documents
- Requirements are shown on the public event page so vendors can read them before applying
- The "limit on similar vendors" is shown to the organizer during review (for example, "Food: 4 of 5 accepted"). The organizer makes the final decision. The system does not auto-reject.

### 3.3 Applications
- Open and close vendor applications for an event
- Review each application with the vendor's profile, submitted permits, and documents
- Approve or decline, with an optional note
- There is no cap on the number of applications. The organizer can close applications at any time. When all slots are taken, the organizer can still approve applications (for example, in case a slot opens).
- A declined vendor can reapply to the same event. A removed vendor can reapply only if the organizer allows it.
- Remove a vendor at any time (for example, an agreed cancellation or withdrawal). See section 6.6.

### 3.4 Slots and floor plan
- Create slots and arrange them on a floor plan
  - Place, resize, and number slots. Slots can be different sizes. The editor stays simple (rectangles).
  - Draw walkways and paths
  - Mark other areas (entrance, exit, stage, food area, and so on)
  - A slot that is `on hold` or `reserved` cannot be deleted, resized, or moved. The organizer removes the vendor first (section 6.6).
- Set slot pricing (one price for all slots, or a price per slot). A price change applies only to slots that are still open. Held and reserved slots keep the price they had when held (section 6.1).
- Choose the **slot selection mode** for the event (see section 5)
- View the vendor list and slot availability at a glance (slot: open, on hold, reserved; payment: pending, submitted, approved, rejected)
- Publish the floor plan. Once published, vendors see it while the event is open to vendors (they need it to pick slots). Attendees see it only after the event is announced.
- The floor plan editor is desktop-only. On mobile, organizers see the floor plan view-only. Everything else works on phones (the product is mobile-first for vendors and attendees).

### 3.5 Payments
See section 6.

### 3.6 Communication
- Message vendors (see section 8)
- Update the event details on the public event page. Changes to date, time, or location email applied and confirmed vendors (section 3.1). Announcements are not in the MVP (see section 9).

### 3.7 Event policy
- Write the event's own cancellation and withdrawal policy (free text) and show it on the event page. The platform does not set these rules. See section 6.6.
- Vendors see the policy before applying. Applying means they have read it.
- Contracts and e-signatures are not in the MVP (see section 9).

## 4. Vendor

### 4.1 Account and profile
- Create a vendor account and submit documents for verification (see section 2.1)
- Create and manage a vendor profile: shop name, products, photos, product categories

### 4.2 Finding and applying to events
- Browse and search upcoming events
- View an event's requirements (categories, limits, permits) before applying
- Apply to an event and submit the required permits or documents
- View application status: `submitted`, `approved`, `declined`, `removed`, `withdrawn`
- Withdraw an application while it is still `submitted` (not yet approved or declined). The organizer is emailed. After approval, the vendor messages the organizer instead. A withdrawn vendor can apply again.
- Reapply after a decline. After removal, reapply only if the organizer allows it (section 3.3).

### 4.3 Slots
- View the event floor plan and slot availability
- Depending on the event's slot selection mode (section 5), choose and hold a slot, or wait for the organizer to assign one
- If all slots are taken, there is no waitlist. The vendor can message the organizer or check back later.
- Release a slot that is on hold (see section 6.6). After the slot is reserved, contact the organizer by message.

### 4.4 Payment
- View the organizer's payment instructions, the amount due, and the payment deadline
- Pay the organizer directly and upload proof of payment (section 6)
- View payment status

### 4.5 Participation
- Track upcoming events joined
- Message the organizer
- Receive email notifications (section 8.1)

## 5. Slot selection modes

The organizer chooses one mode per event, before opening applications. The vendor applies first. Once the application is approved, the vendor gets a slot according to the event's mode (picked by the vendor, or assigned by the organizer).

**Changing the mode:** a reserved (payment approved) slot blocks the change until the organizer removes that vendor. Otherwise, the organizer can change the mode in one step: a warning lists every vendor whose slot is on hold or assigned, and confirming the change clears those holds. The slots return to `open`, and the affected vendors are notified by email.

| Mode | Slots | Who picks the slot |
|---|---|---|
| 1. Open selection | Created by the organizer, no category | Vendors choose any open slot and place it on hold |
| 2. Category selection | Created by the organizer, each assigned a category | Vendors choose from open slots that match their product category and place them on hold |
| 3. Organizer assignment | Created by the organizer, each assigned a category | The organizer assigns each approved vendor to a slot. Vendors do not choose. |

Rules that apply to all modes:
- A vendor must be verified and have an approved application before choosing or being assigned a slot.
- A slot has these states: `open` → `on hold` → `reserved` (payment approved). It returns to `open` if the hold expires, the vendor releases it, or the vendor is removed.
- A slot on hold belongs to one vendor only. Two vendors cannot hold the same slot, and the first to hold it gets it.
- In mode 3, the assigned slot is the one on hold, and the payment deadline starts at assignment.
- Category matching in mode 2: slot categories come from the event's allowed product categories (section 3.2). A vendor can choose any open slot that matches any of their product categories. The organizer can still override by removing and reassigning.
- A vendor can hold or reserve only one slot per event (for now). The slot has its own hold, payment amount, deadline, and proof of payment. To pick a different slot, the vendor releases the hold first. In mode 3, the organizer cannot assign a vendor a second slot.
- Slots can have different sizes and prices. The vendor sees the price of each slot before holding it.
- There is no "move" feature. A vendor on hold who wants a different slot releases it and picks another (modes 1 and 2). In all modes, the organizer can remove the vendor from a slot, which returns it to `open`, and then reassign. After a slot is reserved, the vendor asks the organizer by message (section 6.6).
- Floor plan: a slot shows the vendor's name only once it is `reserved` (payment approved). A slot that is `on hold` shows as "on hold" with no name. Vendors and the public see the same names.
- No waitlist: when no slots are open, vendors cannot hold a slot. In mode 3, the organizer sees the list of approved vendors who have no slot and can assign them if a slot opens.
- **After the event is announced:** in every mode, vendors can no longer pick or hold slots themselves. If a slot opens (for example, a reserved vendor drops out), the organizer can fill it only by assigning an approved vendor, as in mode 3. The organizer sees the list of approved vendors without a slot for this.
- **No deadline past the event start:** every payment deadline, including the retry window after a rejected proof (section 6.3), ends at the normal deadline or the event start time, whichever comes first.

## 6. Payments (manual, outside the platform)

Creavent does not process, hold, or refund money. The organizer and vendor handle payment and any disputes between themselves.

### 6.1 Organizer setup (per event)
- **Payment instructions:** free-form. The organizer can enter any account or channel (GCash, bank, Maya, other) and upload a QR code image, add account name and number, and add notes. There is no restriction to GCash or bank.
- **Price:** vendors pay the **full slot price**. Deposits are not in the MVP (see section 9).
- **Payment deadline:** default is **24 hours** from when the slot is held or assigned. The organizer can set a different deadline for the event (for example, 48 hours). The deadline never runs past the event start (section 5).
- Payment instructions are shown to a vendor right after they hold or are assigned a slot.
- **Locked at hold:** when a slot is held or assigned, its price and the payment instructions are copied onto that hold. If the organizer later changes the price or the payment details, only new holds use the new values. A vendor who already holds a slot always sees the amount and account they were given.

### 6.2 Vendor flow
1. Hold or receive a slot. The deadline starts.
2. See the amount due, the instructions, and the deadline.
3. Pay outside the platform and upload proof of payment (image). The deadline clock stops.
4. Wait for the organizer's decision. The hold cannot expire while the organizer is reviewing.

### 6.3 Organizer review
- Review the proof image against the amount due
- Approve → slot becomes `reserved`
- Reject, with a reason → the vendor gets a fresh **12-hour** window to upload new proof (capped at the event start). The reason should say what to fix (for example, "short by ₱100" or "screenshot is unreadable").
- Extend a single vendor's deadline or retry window
- **Approve without proof:** the organizer can mark a payment as approved without a proof image (for example, cash paid on site, or paid by someone else), with a required note such as "Paid cash at the office". The slot becomes `reserved`.
- Track which vendors have paid

### 6.4 Payment statuses
`pending` (no proof yet) → `submitted` (proof uploaded) → `approved` | `rejected`.
- The deadline clock runs only while the status is `pending` or `rejected`. It stops at `submitted` and stays stopped until the organizer decides.
- If the deadline (or the retry window after a rejection) passes with no new proof uploaded, the hold expires, the slot returns to `open`, and the vendor and organizer are notified by email.

### 6.5 Visibility
Proof-of-payment images are visible to the vendor who uploaded them, the organizer of that event, and admins. No one else can see them.

### 6.6 Cancellations, withdrawals, and removal
Cancellation and withdrawal rules (refunds, notice periods) are decided by each organizer and written in their event policy. Creavent does not set or enforce them. The platform only provides two things: a way to remove a vendor, and messaging.

- **Release a hold:** a vendor whose slot is on hold (payment not yet approved) can always release it on their own. Organizers cannot turn this off. The slot returns to `open` and the organizer is notified by email.
- **After the slot is reserved:** the vendor contacts the organizer through in-app messaging. The organizer decides under their own policy.
- **Organizer removes a vendor:** the organizer can remove a vendor from an event at any time, for example when a withdrawal is agreed or a vendor cancels. The slot returns to `open` and the vendor is notified by email.
- **Records are kept on removal:** removing a vendor does not delete their proof-of-payment files. They are marked as archived and become read-only. The vendor, the organizer, and admins can still view and download them, so either side has evidence if a dispute comes up. See retention in section 6.7.
- Refunds and any disputes are handled by the organizer and vendor directly. Creavent has no role in them.
- The platform shows a short notice to both sides saying that payments happen outside Creavent.
- **Fraud notice:** when a vendor is shown payment instructions, the notice also says that Creavent does not hold or guarantee payments, and that vendors should check the organizer's verification badge and past events before paying. Vendors can report an organizer with the report button (section 7), and admins can suspend reported organizers. A dedicated "report a scam" process is a later feature.

### 6.7 Data to store
Amount due, amount paid, status, payer, payee, proof image, organizer's decision and reason, and timestamps. Fee fields (platform fee, who pays, processing cost) are kept in the data model but unused. See [Revenue model](revenue-model.md) §7.

**Retention:** payment records are kept for 90 days after the event date (or, for events that never took place, 90 days after the event was canceled), then permanently deleted. This covers the proof-of-payment images, the payment records themselves (amounts, statuses, decisions), the payment QR images, and the payment instructions copied onto each hold. The record of which vendor had which slot is kept. Archived records from removed vendors follow the same schedule. The 90 days is a default and can be changed. The vendor and organizer are told about this in the terms of use. Confirm with a lawyer how long records should be kept under the Philippine Data Privacy Act.

## 7. Attendee

- Browse upcoming announced events, sorted by date (soonest first), and filter by location and date range. Events that are only open to vendors are not shown.
- View an event page: schedule, location, description, organizer, and the event floor plan (once the organizer has published it)
- See the list of accepted vendors on the event page (vendors with a `reserved` slot only)
- See verified badges for organizers
- See changes to event details on the event page
- Optional account (Google, or email and password) to save events, or to follow events and organizers
  - Following an organizer sends an email when they announce a new event. Following an event sends emails about changes and cancellations. Optional emails include an unsubscribe link.
- Logged-in users can report an event or user with a report button
- Attendees cannot contact organizers. There is no attendee messaging or contact form in the MVP.

### 7.1 Organizer page

Every organizer has a public page (`/organizers/<slug>`) that helps attendees and vendors get to know them:
- Display name, logo, verified badge, about text, city, social media links, and when they joined Creavent
- Upcoming announced events and past (completed) events
- Number of events held on Creavent
- Follow and report buttons (signed-in users)

The organizer edits it from their organizer profile. There is no contact form. The page is not shown while the organizer is suspended, deactivated, or deleted. Pages are listed in the [Sitemap](sitemap.md).

Not included in the MVP: public vendor pages or catalogs, and a vendor directory. The accepted-vendor list and the published floor plan (which shows vendor names on reserved slots) are the only public places vendors appear.

## 8. Notifications and messaging

### 8.1 Email notifications
All notifications are sent by email through [Resend](https://resend.com). There are no push or SMS notifications in the MVP.

- **Required emails always send** and cannot be turned off: account verification, application, slot hold and payment, deadline and reminder, removal, cancellation and event changes, and new-message emails.
- **Optional emails** (a followed organizer announces a new event) include an unsubscribe link in every email.
- **Email address checks:** the email is verified at signup. If Resend reports a hard bounce, the user sees a banner asking them to update their email.
- The sending domain and sender name are decided when the domain is bought (see [Open questions](open-questions.md)).

| Trigger | Recipient |
|---|---|
| Signup, or a new email address (link to verify it) | User |
| Forgot password (reset link) | User |
| Account verified or rejected | Organizer, vendor |
| New application submitted | Organizer |
| Application withdrawn by the vendor | Organizer |
| Application approved or declined | Vendor |
| Slot placed on hold, or assigned | Vendor (includes payment instructions and deadline) |
| Hold expired, slot released | Vendor, organizer |
| Proof of payment uploaded | Organizer |
| Payment approved or rejected | Vendor (a rejection includes the reason and the new 12-hour window) |
| Payment reminder (for example, 6 hours left) | Vendor |
| Vendor removed from event | Vendor |
| Vendor released a held slot | Organizer |
| Slot selection mode changed (holds cleared) | Affected vendors |
| New message | Recipient |
| Event canceled, or date, time, or location changed | Applied and confirmed vendors, plus following attendees (announced events only) |
| Event frozen because the organizer was suspended | Vendors who applied, or hold or reserved a slot (includes the support address) |
| Followed organizer announces a new event | Attendees who follow that organizer (with an unsubscribe link) |

### 8.2 Messaging
- In-app messaging between an organizer and a vendor, in one thread per event and vendor
- New messages trigger an email notification
- An in-app unread indicator (a dot or count) shows new messages in the inbox and on each thread, since email is not instant
- Attendee messaging is not included

### 8.3 Announcements
Not in the MVP (see section 9). Date, time, location changes and cancellations still send emails (section 8.1).

## 9. Out of scope for the MVP

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
- Admins have full access to all roles, including proof of payment.
- Waitlist, deposit option, and event announcements are moved out of the MVP.
- Contract signing is moved out of the MVP. Vendors accept the organizer's event policy by applying.
- Online payment integration stays out of the MVP. Payments are manual with proof upload.
- Application approval is required before a vendor can choose or be assigned a slot.
- The default payment deadline is 24 hours, and organizers can change it.
- Withdrawal and cancellation rules are set by each organizer. The platform only provides removal and messaging.
- Vendors can always release a held slot. Organizers cannot turn this off.
- Removing a vendor does not delete their proof of payment. Records are archived, readable by both sides and admins, and deleted 90 days after the event.
- Verification documents are as listed in section 2.1.
- A vendor can hold or reserve only one slot per event (for now). Holding more than one slot is not supported in the MVP.
- Slots can have different sizes and prices. The floor plan editor stays simple.
- No slot-move feature. The vendor applies, is approved, then gets a slot according to the event's mode. To change slots, release a hold or have the organizer remove and reassign.
- Mode 2 slot categories come from the event's allowed categories. A vendor can pick any slot matching any of their categories.
- No cap on applications. When slots are full, the organizer can still approve applications.
- Declined vendors can reapply. Removed vendors can reapply only if the organizer allows it.
- Changing the slot selection mode clears all unpaid holds after a warning, and the affected vendors are emailed. Reserved slots block the change.
- The floor plan is visible only once the organizer publishes it: to vendors while the event is open to vendors, and to attendees once it is announced. Vendor names show only on reserved slots, and held slots show as "on hold". The accepted-vendors list shows reserved vendors only.
- Following an organizer sends an email when they announce a new event. Optional emails have an unsubscribe link.
- The event listing is sorted by date, with filters by location and date.
- Users sign in with Google, or with an email and password. No magic links.
- Only logged-in users can report a user or event.
- Attendees cannot contact organizers in the MVP.
- The admin team is small, all with full access, and admin actions on behalf of users are logged. No admin levels.
- Unverified organizers can draft events but not open them to vendors. The target verification review time is 1 to 2 business days.
- Rejected users resubmit with new documents or email support. There is no separate appeal process.
- Support is a support email address shown in the app.
- Launch area is Davao City (PHP, Asia/Manila, English). The MVP is free for everyone, and the terms say fees may be introduced later with notice.
- The floor plan editor is desktop-only, and the rest of the product is mobile-first.
- Required emails always send. Optional emails (followed-organizer events) have an unsubscribe link.
- Emails are verified at signup, and a banner appears if emails bounce.
- Messages show an in-app unread indicator in addition to the email.
- Fraud stance: a clear notice when payment instructions are shown, strong organizer verification (legitimate documents, valid ID, selfie, and social media or past event history), and the report button. A dedicated scam-report process comes later.
- The deadline clock stops once proof is uploaded and stays stopped until the organizer decides. After a rejection, the vendor gets a fresh 12-hour window. Organizers can extend a single vendor's deadline.
- Price and payment instructions are locked onto a slot when it is held or assigned. Held and reserved slots cannot be deleted, resized, or moved.
- Events go `draft` → `open to vendors` → `announced`. Organizers finalize vendors before announcing to attendees. After the announcement, open slots can only be filled by organizer assignment.
- No payment deadline runs past the event start.
- A suspended organizer's upcoming events are hidden and frozen, affected vendors are emailed, and an admin reinstates or cancels each event.
- One account can hold the vendor role, the organizer role, or both, each with its own verification.
- Files are stored in Cloudflare R2 through the S3 SDK, and the API on Render handles every upload (section 11). Event covers, organizer logos, avatars, and vendor photos are public. Proofs of payment, payment QR codes, and application and verification documents are private.
- Browsers upload straight to storage with short-lived signed URLs. The API checks and re-encodes every file before it is used. Originals are not kept.
- Images accepted: JPEG, PNG, WebP, and HEIC. Documents may also be PDF. Maximum size is 5 or 10 MB depending on the purpose (section 11.1). Event covers are 16:9.
- No virus scanning in the MVP. PDFs are only allowed in private purposes and are served as downloads.
- Organizers can approve a payment without a proof image, with a required note (for example, cash on site).
- Vendors can withdraw an application while it is still `submitted`.
- Users can deactivate or delete their account (section 1).
- Payment records, proofs, and payment QR images are deleted 90 days after the event. Verification documents are kept (check with a lawyer, G2 and G3 in [Open questions](open-questions.md)).
- Changes to event date, time, or location are not kept as a history. They only send emails.
- The technical setup is in [Architecture](architecture.md).
- Every organizer has a public organizer page (section 7.1).
- Users accept the terms and privacy notice and confirm the minimum age at signup. Acceptances are recorded per version (section 1).
- Admins change records from admin pages and have a read-only "view as this user". Admins maintain the category list and platform settings (section 2).

### Open
1. Confirm the record retention period (90 days) and data handling with a lawyer under the Philippine Data Privacy Act.
2. Decide how HEIC photos are decoded on the server (section 11.4). See [Open questions](open-questions.md), I1.

## 11. File uploads

Every upload follows the same rules. The tables behind it are in the [Data model](data-model.md#52-files).

### 11.1 What can be uploaded

"Image" means a still JPEG, PNG, WebP, or HEIC photo. GIF, SVG, and animated files are not accepted. Logos and avatars are not described elsewhere in this spec, so this table is where they are defined.

| Purpose | Used for | Uploaded by | Who can open it | Types | Max size | Limit |
|---|---|---|---|---|---|---|
| Event cover | Banner and card image of an event (3.1) | The event's organizer | Anyone (public) | Image | 10 MB | 1 per event |
| Organizer logo | Organizer's public profile (3.1) | The organizer | Anyone (public) | Image | 5 MB | 1 |
| Avatar | A user's picture | The user | Anyone (public) | Image | 5 MB | 1 |
| Vendor photo | Vendor profile (4.1) | The vendor | Anyone (public) | Image | 10 MB | 8 per profile |
| Payment QR | Payment instructions (6.1) | The event's organizer | The organizer, vendors with a slot hold at the event, admins | Image | 5 MB | 1 per payment method |
| Proof of payment | Payment proof (6.2) | The vendor holding the slot | The vendor, the event's organizer, admins | Image | 10 MB | 1 per proof |
| Application document | Event permits and documents (3.2, 4.2) | The applying vendor | The vendor, the event's organizer, admins | Image or PDF | 10 MB | 3 per requirement |
| Verification document | ID, selfie, permits (2.1) | The user being verified | The owner and admins | Image or PDF | 10 MB | 6 per submission |

Minimum size: event covers must be at least 1280 x 720 px. Logos and avatars must be at least 256 x 256 px.

"Public" means anyone with the file's web address can open it. The app shows these files only where they belong, and addresses are random and cannot be guessed. Hiding or freezing an event does not hide its cover's address. This is accepted for the MVP.

### 11.2 Storage

- Files live in Cloudflare R2, used through the S3 SDK. Only the server (the API and its background worker, hosted on Render) holds the R2 credentials. Browsers never see them.
- There are two buckets per environment (development, staging, production never share one): a **public** bucket for the public purposes, served from a custom domain behind Cloudflare's CDN, and a **private** bucket for everything else, with no public access.
- Names and paths are random. A file's path is its purpose and a random id. It never contains a user's name, an email, an event name, or the uploaded file name.
- Unchecked uploads never go to the public bucket. They land in an `incoming/` area of the private bucket first (section 11.3).

### 11.3 Upload flow

1. **Ask.** The app tells the API the purpose, file type, and size. The API checks that the user is allowed to upload this kind of file here (for example, only the organizer of the event can upload its cover), that the type, size, and count limits hold, and that the user is not over the rate limit. It creates a file record as `pending` and returns a signed upload address that expires in 5 minutes and accepts only the declared type and size.
2. **Upload.** The browser sends the file straight to the `incoming/` area of the private bucket.
3. **Complete.** The browser tells the API it is done. The API reads the uploaded file, runs the checks and processing in sections 11.4 and 11.5, writes the final files to the right bucket, deletes the `incoming/` copy, and marks the record `ready`. If any check fails, the record and the upload are deleted and the user sees a clear reason (for example, "This file is over 10 MB" or "This photo is too small. Use at least 1280 x 720").
4. **Attach.** A file can be attached to an event, profile, application, or payment only when it is `ready`, only to a place that matches its purpose, and only by the user who uploaded it (or an admin).

A user can have at most 20 `pending` uploads at a time, and upload requests are rate limited per user. Abandoned uploads are cleaned up (section 11.7).

### 11.4 Checks

The browser also checks type and size first, so mistakes show up early. Those checks are only for convenience. The API repeats and enforces all of these:

- **Type:** the real type is read from the file's first bytes and must be on the purpose's allowed list. The type the browser claimed must match. File extensions are ignored.
- **Size:** the uploaded size must be within the purpose's limit (11.1).
- **Images:** the file must decode as a real image and be no larger than 50 megapixels (a guard against files built to exhaust memory), and meet the minimum size for its purpose.
- **PDFs:** the file must start with the PDF signature and be within the size limit. PDFs are not rewritten.
- **HEIC:** accepted, and converted to WebP like every other image. How the server decodes HEIC is still open (I1 in [Open questions](open-questions.md)).

### 11.5 Processing

Every image is re-encoded as WebP, which removes hidden data such as the GPS location in phone photos and makes sure what is stored is a clean image. Originals are not kept. Phone photos are rotated upright first.

Public images get two sizes, and the app uses the one that fits:

| Purpose | `large` | `small` |
|---|---|---|
| Event cover | 1600 x 900, cropped to 16:9 from the center | 640 x 360, cropped to 16:9 from the center |
| Vendor photo | Up to 1600 px on the long edge, shape kept | 400 x 400, cropped square |
| Organizer logo | Fits inside 512 x 512, no cropping | Fits inside 128 x 128, no cropping |
| Avatar | 256 x 256, cropped square | 64 x 64, cropped square |

Private images (proof of payment, payment QR, application and verification images) are stored as one WebP, at most 2400 px on the long edge, so text on a screenshot or ID stays readable. PDFs are stored as uploaded. Images are never enlarged. A smaller image is stored at its own size.

Processing runs while the browser waits for the Complete step. The API limits how many images it processes at once so a busy moment cannot run it out of memory.

### 11.6 Viewing and downloading

- **Public files:** the app uses the file's web address on the public domain. Each address is unique to one upload and is cached for a long time, so replacing a picture just creates a new address.
- **Private files:** the app asks the API, which checks that the person may open the file (section 11.1) and sends them to a signed address that expires in 5 minutes. Addresses are never stored or shared, and every view gets a new one. PDFs always download instead of opening in the page.
- Downloads are named from the file's purpose and date, not from the original file name.

### 11.7 Replacing, removing, and cleanup

- **Replacing** a picture (cover, logo, avatar) creates a new file and removes the old one. Removing a vendor photo removes that file.
- A removed file is deleted from storage within 24 hours, along with all its sizes.
- Uploads that never reach Complete are deleted automatically after 24 hours.
- Proof-of-payment and payment QR files follow the retention rules in section 6.7. Verification documents are not deleted automatically, and only admins can open them after the account is closed (the retention period is still to be checked with a lawyer, see [Data model](data-model.md#8-retention-and-archiving)). When a user deletes their account, their avatar is removed.

### 11.8 Not in the MVP

Virus scanning, keeping original files, a crop tool beyond the automatic center crop, video, and GIF or animated images.

