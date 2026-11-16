# Creavent MVP Feature Specification

**Status:** Draft for MVP. The MVP is centered on organizers (flea market organizers first) and kept as simple as possible: features that are not needed to run a first event are deferred (section 9). For a short summary, see [Project details](project-details.md). For the payment approach, see [Revenue model](revenue-model.md).

Last updated: 2026-11-14

## 1. Roles and accounts

| Role | Account | Before they can work |
|---|---|---|
| Organizer | Required | Approved by an admin before opening an event to vendors (section 2.1) |
| Vendor | Required | Nothing extra. A vendor can apply right after creating a profile (section 1.1) |
| Attendee | None in the MVP | Browses without an account |
| Admin | Internal (Creavent team) | n/a |

- **Signup:** users sign up with Google, or with an email and password (the email is verified at signup with a link sent to their inbox). Accounts are for vendors and organizers. Attendees browse events and event pages without an account (section 7).
- **Signup choice:** before the form, `/signup` asks **"I'm signing up to: Sell at events (vendor account) or Run events (organizer account)"**. This choice only pre-selects the role in onboarding (section 1.1). Roles are still added after the email is confirmed, and one account can hold both roles. The choice is not stored: it is only passed to onboarding.
- **Log in page:** besides signing in, `/login` offers **Create a vendor account** and **Create an organizer account**. Each is an entry point to signup with the matching choice.
- **No identity verification in the MVP.** Creavent does not collect government IDs or selfies. Identity verification may be added after the legal review (see [Legal](legal.md)).
- **Signup agreements:** the signup fields are full name, email and password (or Google). At signup, every user accepts the terms of use and the privacy notice, and confirms they meet the minimum age ("I'm 18 or older"; 18 for now, pending legal review). Each acceptance is recorded with the document version. When the terms or privacy notice change, users accept the new version the next time they sign in.
- **Same email, same account:** signing in with Google using an email that already has an account opens that account. If that account's email was never verified, Google sign-in verifies it and removes the old password, so no one can claim someone else's email by signing up first.
- **One account, more than one role:** a person has one login and can add the vendor role, the organizer role, or both (many flea market organizers also sell at other markets). The user switches between the vendor and organizer dashboards.
- **Contact number:** a mobile number is required for either role and is asked in onboarding (section 1.1). Organizers see the contact number of vendors who apply to their events, and vendors see the organizer's contact details for the event (section 8.2). A vendor's number is never shown on their public page (section 7.2).
- Admins are created by the Creavent team, not through public signup.
- **Closing an account:** there is no self-serve option in the MVP. The user emails support, and the team deletes the account by hand: personal data is wiped and the account cannot come back. It is not done while the user has a slot assigned or reserved, or runs an event that is open to vendors or announced. Records that other people rely on (reports, audit logs, application documents and payment records until their retention ends) are kept. Details are in the [Data model](data-model.md#51-accounts-and-roles).
- Launch area: Davao City first. Currency is PHP (₱), time zone is Asia/Manila, and the interface is in English with simple wording.
- The MVP is free for everyone. The terms of use say that fees may be introduced later with notice.
- Users reach the Creavent team through a support email address shown in the app (footer, account pages, and approval emails).

### 1.1 Onboarding

Onboarding starts after the email is confirmed. Vendors and organizers each have a 4-step flow. Both flows start with the same step 1, **"How will you use Creavent?"** (vendor, organizer, or both). The choice made on the signup page pre-selects the answer. The role is added here, and the user can pick both.

Each step shows its progress ("Step 2 of 4"). Progress is saved, so the user can choose **Finish later** and continue from where they stopped. Each step's fields are saved as they are entered, and the last completed step is kept for each role.

- **Both roles:** the vendor flow runs first, then the organizer flow. Step 1 is shown once, and each flow shows its own "Step N of 4".
- **Required before acting:** a vendor cannot apply until the shop name, mobile number, and at least one product category are set (an application must use one of the vendor's categories). An organizer cannot create an event until the display name and mobile number are set.

**Vendor onboarding**
1. **Role.**
2. **Shop:**
   - shop name (required, shown on event vendor lists)
   - product categories (pick all that apply, no limit)
   - about your shop (optional, up to 300 characters)
   - products (optional, free text)
3. **Photos** (can be skipped):
   - avatar or logo, at least 256 x 256 px, up to 5 MB
   - up to 8 product photos, JPEG, PNG, or WebP, up to 10 MB each
   - a note that these are public on the vendor page (section 7.2)
4. **Contact:**
   - mobile number (required): shown to organizers on applications, never on the public page
   - social media links (optional, public)

**Vendor done screen:**
- a preview of the vendor profile, with a link to their public page
- events open to vendors that accept their categories
- a "Finish your profile" checklist (for example, "4 of 5 done") that shows the completed items and the optional ones still empty, such as a logo, more photos, or a social link

Permits are not saved to the profile. They are uploaded with each application (section 4.2).

**Organizer onboarding**
1. **Role.**
2. **Organizer page:**
   - display name (required)
   - page link (`/organizers/[slug]`, editable)
   - logo (optional), at least 256 x 256 px, up to 5 MB
   - city
   - about (optional)
3. **Contact:**
   - mobile number (required)
   - contact email (required for approval, and it can differ from the login email)
4. **Get approved:**
   - at least one link to their social media pages or past event posts. These links are also the social links shown on their organizer page (section 7.1)
   - a "What we check" list (section 2.1)
   - the review target of 1 to 2 business days
   - two buttons: **Submit for review** or **Do this later**. "Do this later" leaves the approval status at `not submitted`. Drafts are still allowed (section 2.1).

**Organizer submitted screen** (after Submit for review):
- the status "Pending review"
- a short timeline: submitted, then reviewed, then approved
- a "Create your first event as a draft" next step
- a preview of their organizer page
- the support email address

## 2. Admin

The Creavent team is a small group of admins, all with the same full access. There are no admin levels in the MVP.

Admins keep the platform trustworthy and support users. An admin can view everything other roles can see, including events, applications, application documents, and proof-of-payment images. Admin actions are limited to the list below. Rare data fixes are done by the team directly in the database.

- Review organizer approval requests (section 2.1): approve, or reject with a reason shown to the user, and re-review after a resubmission. An optional internal note is kept with the review (admins only).
- Suspend or reinstate a user's vendor role or organizer role (each role separately), with a reason shown to the user
- Hide an event that breaks platform rules, with a reason that is emailed to the organizer, or show it again
- View and handle user reports (fake account, scam, inappropriate content). Reports come from the report button and from the support inbox (section 2.2)

The product category list, retention periods, deadlines, minimum age, support email, and the current terms and privacy versions are set in configuration and seed data, not from admin pages. Changing them needs a deploy, not a code change.

### 2.1 Organizer approval

Organizer approval replaces identity verification in the MVP. It is the main protection against fraud, because Creavent holds no money and vendors pay organizers directly (section 6). No documents are uploaded: the admin only reviews information the organizer already shows in public.

**The organizer gives:**
- Contact number and contact email (required)
- Links to their social media pages, and to past event posts where available (at least one link is required)

**The admin checks** that the pages and past events look genuine, and may message or call the organizer before deciding. The target review time is 1 to 2 business days.

Approval states (organizer role only): `not submitted` → `pending review` → `approved` | `rejected` (can resubmit). An organizer who is not approved can create draft events but cannot open them to vendors.

**"Approved by Creavent" badge:** shown on the organizer page, event pages, and event cards. Wherever it appears, it links to a short explanation: Creavent reviewed this organizer's public pages and past events. It is not a guarantee. There is no "verified" wording anywhere in the MVP.

**Links shown in public:** the links the organizer submits for approval are saved as the social links on their organizer page (section 7.1). The onboarding step says so.

**Editing after approval:** an approved organizer edits their profile freely. Changing the display name, or adding a link that wasn't reviewed, sends them back to pending review, and the badge hides until an admin approves again. Removing a link, or changing the page link, city, about, logo, or contact email, keeps the approval (decided 2026-11-13, open question D9).

**Suspended roles:** an admin suspends one role at a time (vendor or organizer), with a reason that the user sees in the app. A suspended vendor cannot apply or manage slots, and their vendor page is not shown (section 7.2). A suspended organizer cannot manage events or applications, and their organizer page is not shown (section 7.1). The user's other role keeps working. Organizers of events a suspended vendor joined are not emailed automatically. When an organizer with upcoming events is suspended, an admin hides those events and emails the affected vendors from the support address. There is no automatic freeze in the MVP.

**Appeals:** there is no separate appeal process. A rejected organizer resubmits with better links, or emails support to contest the decision. An admin re-reviews either way.

### 2.2 Reports

- Signed-in users report an event or user with the report button. Attendees and anyone else email the support address, and an admin adds that email as a report (source "support email") so every report is handled in one queue.
- Each report has a short reference number (for example, RPT-0142).
- Open reports about the same event or user are shown together, oldest first, with what each person said. One decision handles them all: dismiss, hide the event, or suspend the user's role. The admin can add an internal note on what they checked.

Notes:
- Payment disputes and refunds between organizers and vendors are not Creavent's responsibility (see section 6). Admin access is for support, moderation, and fraud reports.
- Admin decisions (approvals, suspensions, hidden events, reports) and each admin view of an application document or proof of payment are recorded in the audit log (who, what, when).

## 3. Organizer

### 3.1 Account and event setup
- Add the organizer role, fill in the organizer profile that feeds the public organizer page (section 7.1), and request approval (section 2.1).
- Create and manage events: name, event type, dates and daily hours (section 3.1.1), location, description, cover image, contact details (shown to vendors, not to attendees), an optional applications close date (section 3.3), and optional ingress details for vendors (for example, "From 3 PM, Gate 2"), shown to vendors with a slot
- **Event type:** each event has one type. The initial list is Flea market, Bazaar, and Pop-up. Flea markets stay the MVP focus. The organizer picks the type on the Details tab of event setup, and Flea market is the default. The type can be changed until the event is announced. The type list is managed in seed data and configuration, like product categories (no admin page). The type shows as a small tag on event cards, event rows, event pages, and organizer dashboards. Attendees can filter by type (section 7.3).
- Event states: `draft` → `open to vendors` → `announced` → `completed`, or `canceled`
  - **Open to vendors:** signed-in vendors can find the event, apply, and pay for their assigned slot. Attendees cannot see it. This is when the organizer fills and finalizes the vendor list. Opening needs organizer approval. The setup screen has an **"Open to vendors" checklist** ("4 of 5 required steps done") with five required steps: name, date, venue and cover; vendor requirements (at least one accepted category); the cancellation and withdrawal policy; at least one slot; and payment instructions. The vendor floor plan is listed as optional.
  - **Preview as vendor:** from event setup, the organizer can see the event page as a vendor will see it, at any status.
  - **Announced:** the organizer chooses when to announce. The event appears in attendee discovery. Organizers are expected to finalize vendors before announcing.
  - Edit an open or announced event. Changes to date, time, or location notify applied and confirmed vendors by email.
  - Cancel an event. Applied and confirmed vendors are notified by email. Any refunds are handled between the organizer and vendors.
  - Delete a draft. A draft was never shown to vendors or visitors, so it is deleted for good, with its requirements, slots, and payment details, after a confirmation. Once an event has been opened to vendors it can't be deleted, only canceled, so its records stay.
  - Completed events remain on the platform as past events.
- Event page, shared by link. Signed-in vendors can see it once the event is open to vendors. Attendees can see it once the event is announced.

### 3.1.1 Dates and multi-day events

Weekend markets often run several days in a row, for example Friday to Sunday.
- An event runs on **1 to 7 days in a row**. The organizer picks a start date, an end date, and one opening and closing time used for every day (for example, Fri, Nov 20 to Sun, Nov 22, 4 PM to 10 PM daily).
- The closing time is later than the opening time on the same day. Markets that run past midnight are not supported in the MVP.
- **Vendors are locked in for the whole event.** A slot covers every day, has one price, and is paid once. There are no single-day slots.
- Events on separate dates (for example, two Saturdays) are separate events. Recurring events are out of scope (section 9).
- **How it shows:**
  - Single day: "Sat, Nov 14 · 5 PM to 11 PM".
  - Multi-day: "Fri, Nov 20 to Sun, Nov 22 · 4 PM to 10 PM daily". Date stamps show the range ("Nov 20 to 22") and the number of days ("3 days").
- Changing the dates or the hours sends the "event changed" email (section 8.1).
- The payment deadline and the applications close date are capped at the opening of the first day.

### 3.2 Vendor requirements
- Set requirements per event: allowed product categories, limit on similar vendors per category, required permits or documents. A required document can apply to every vendor or only to one category (for example, a sanitary permit for food and drinks only)
- Requirements are shown only to signed-in vendors on the event page, so they can read them before applying. Attendees do not see them.
- The "limit on similar vendors" is shown to the organizer during review (for example, "Food: 4 of 5 accepted"). The organizer makes the final decision. The system does not auto-reject.

### 3.3 Applications
- Open and close vendor applications for an event. The organizer can also set an applications close date (optional, no later than the event start). After that time, vendors can no longer apply, and the event shows "Applications closed". The organizer can still close applications earlier, or reopen them by changing the date
- Review each application with the vendor's profile, contact number, uploaded permits and documents, and preferred slot (when the event lets vendors choose one, section 3.4)
- Approve or decline, with an optional note
- There is no cap on the number of applications. The organizer can close applications at any time. When all slots are taken, the organizer can still approve applications (for example, in case a slot opens).
- A declined vendor can reapply to the same event. A removed vendor can reapply only if the organizer allows it.
- Remove a vendor at any time (for example, an agreed cancellation, a withdrawal, or no payment by the deadline). See section 6.6.

### 3.4 Slots and floor plan
- **Slots are a list.** The organizer adds slots with a number (label), an optional section (for example, "Indoor", "Inner room", or "Outdoor"), an optional size (for example, "2m x 2m"), an optional note (for example, "Near the entrance" or "Food row, with power"), and a price. There is no drawing tool in the MVP.
- **Add a row of slots:** to save typing, the organizer enters an optional section, a prefix, a number range, a size, and a price (for example, Outdoor, C, 01 to 06, 3 x 3 m, ₱1,200), and the app adds C-01 to C-06. Each slot can be edited after.
- **Grouping:** vendors see the slots grouped by section, or by the label's prefix when a slot has no section (for example, "Outdoor: O-01 to O-15, 2 x 1.5 m, ₱6,500, 13 of 15 open"). Sections let one group hold slots with unrelated labels (for example, O-01 to O-15, a photobooth, and food truck parking).
- **How slots are filled.** Each event has a slot mode, chosen on the Slots tab:
  - **I assign slots** (the default): vendors apply without choosing a slot, and the organizer assigns one after approving them.
  - **Vendors choose a preferred slot:** when applying, the vendor can pick one open slot as their preference, or "No preference" (section 4.3). The organizer still assigns every slot (section 5) and sees the preference when assigning.
  - The mode can be changed at any time. Preferences already sent are kept and still shown to the organizer. Switching to "I assign slots" only removes the choice for new applications.
- **Slots per vendor** (decision P2): the Slots tab sets how many slots one vendor can ask for, from 1 (the default) to 10. Lowering it doesn't change applications or slots already given.
- **Set aside a slot** (decision P1): from a slot's Edit dialog, the organizer can keep it for their own booth, a sponsor, or another arrangement, with an optional note only they see (for example, "Sponsor booth"). A set-aside slot can't be assigned or preferred: vendors see it as Taken, the organizer sees "Set aside" with the note, and it isn't counted as open. A slot with a vendor can't be set aside. Unticking it opens the slot again. "Set aside" is used because "reserved" means a slot whose payment is approved.
- Set slot pricing (one price for all slots, or a price per slot). A price change applies only to slots that are still open. Assigned and reserved slots keep the price they had when assigned (section 6.1).
- A slot that is `assigned` or `reserved` cannot be deleted or renamed. The organizer removes the vendor first (section 6.6).
- **Floor plan images.** The organizer uploads up to two images, made in any tool (Canva, a photo of a drawing, and so on):
  - **Vendor floor plan:** the layout with empty, numbered slots. It is uploaded at the top of the Slots tab and shown next to the slot list as a reference while the organizer adds slots (on phones, behind "Show floor plan", and tapping it opens it full screen). Signed-in vendors see it while the event is open to vendors or announced, so they know where each slot is, and on the apply form when they choose a preferred slot.
  - **Public floor plan:** the final layout with the vendors placed. Attendees see it once the event is announced. The organizer uploads it on the Public floor plan tab after finalizing vendors.
  - Both are optional. Slot numbers on the images should match the slot list, but the system does not check this.
- View the vendor list and slot availability at a glance (slot: open, assigned, reserved, set aside; payment: pending, submitted, approved, rejected, overdue)
- **Slots at a glance:** the organizer's vendors page starts with a slot overview that counts slots that are open, assigned, reserved, overdue, and set aside.
- Everything works on phones, including uploading floor plan images (the product is mobile-first).

### 3.5 Payments
See section 6.

### 3.6 Communication
- There is no in-app messaging in the MVP (section 9). Signed-in vendors see the event's contact details for vendors, and the organizer sees each applicant's contact number (section 8.2).
- Update the event details on the event page. Changes to date, time, or location email applied and confirmed vendors (section 3.1).

### 3.7 Event policy
- Write the event's own cancellation and withdrawal policy (free text) and show it on the event page to signed-in vendors. The platform does not set these rules. See section 6.6.
- Vendors see the policy before applying. Applying means they have read it.
- **Prefill:** a new event starts with the policy text of the organizer's most recent event, so most organizers write it once. The Policy tab says which event it came from, and the organizer can edit it for this event only. On an organizer's first event, the Policy tab shows a short example policy to edit, and the checklist step counts only after they save it. There is no global policy setting.
- Editing the policy changes it for new applications only. Each application keeps the text the vendor accepted (section 6.6).
- Contracts and e-signatures are not in the MVP (see section 9).

### 3.8 Organizer dashboard
The organizer dashboard (`/organizer`) shows:
- **To-do counts** for each event that is open to vendors or announced ("To do for Bajada Christmas Flea"): applications to review (with the date of the oldest), proofs of payment to check (with their total amount), overdue payments, and approved vendors with no slot (with the number of open slots). Each count links to the event's vendors page.
- **Your events**, in Upcoming and Past tabs. Each row shows the event type tag, the status, how the slots are filled (reserved, assigned and waiting for payment, open), and the next step (for example, "Review 6 applications" or "Add payment details").
- The organizer's approval status in the side menu (for example, "Approved by Creavent, since Mar 2025").

## 4. Vendor

### 4.1 Account and profile
- Add the vendor role through onboarding (section 1.1), with a contact number. No approval or documents are needed.
- Create and manage a vendor profile: shop name, about text, products, product categories, avatar, up to 8 photos, social media links, and city. The profile feeds the public vendor page (section 7.2).
- The page link is `/vendors/[slug]`. It is generated from the shop name and can be edited (slug rules are in section 7.2).
- City is optional. It is edited on the profile page and is not asked in onboarding.
- The product category list is set in seed data. The initial list is Preloved clothing, Vintage, Handmade and crafts, Food and drinks, Plants, Books and toys, and Other.

### 4.2 Finding and applying to events
- Browse and search upcoming events that are open to vendors or announced
- View an event's requirements (categories, limits, permits) and policy before applying
- On the vendor events page and the event page, see the remaining spots in their categories at an event, when the organizer set a limit (the limit minus the vendors already accepted in that category, for example "5 of 12 spots for this category are left"). It is a guide only, as in section 3.2. The event page also lists every accepted category with its limit and spots left, and the documents to upload, marking those that apply to one category only.
- The event page sums up the slot fee range, the applications close date, the payment deadline ("24 hours after assignment"), and how the organizer is paid (for example, "GCash or bank").
- Apply to an event and upload the required permits or documents. When the event lets vendors choose, also pick a preferred slot or "No preference" (section 4.3)
- View application status: `submitted`, `approved`, `declined`, `removed`, `withdrawn`
- Withdraw an application while it is `submitted` or `approved`, including with an assigned slot that isn't paid yet, which is released with it. The organizer is emailed. Once the payment is approved (the slot is `reserved`), the vendor contacts the organizer instead. A withdrawn vendor can apply again (decided 2026-11-15).
- Reapply after a decline. After removal, reapply only if the organizer allows it (section 3.3).

### 4.3 Slots
- Slots are assigned by the organizer (section 5). Vendors cannot book or hold a slot themselves.
- **How many slots** (decision P4): when the event allows more than one slot per vendor, the apply form asks "How many slots?", up to the limit. The number can't be changed after applying.
- **Preferred slot:** when the organizer chose "Vendors choose a preferred slot" (section 3.4), the apply form shows the vendor floor plan (if uploaded) and the slots grouped by section, each marked **Open** or **Taken** (taken means `assigned`, `reserved`, or set aside). The vendor picks open slots, up to the number they asked for, or "No preference". It is optional.
  - A preference holds nothing. Other vendors can prefer the same slot, and it stays open until the organizer assigns someone. The form says "Your pick isn't reserved until the organizer assigns it."
  - Until a slot is assigned, the vendor can change the preference to another open slot, or clear it ("No preference"), from the application page. With an assigned slot that isn't paid yet, the vendor can **pick another slot**: the assigned slot is released and the new pick becomes the preference for the organizer to assign. The organizer is emailed (decided 2026-11-15).
- See the assigned slot's number, size, and price, and the vendor floor plan image if the organizer uploaded one
- If all slots are taken, there is no waitlist. The vendor can contact the organizer or check back later.
- With an assigned slot before payment is approved, the application page offers a **change of plans**: pick another slot (when the event lets vendors choose), release the slot and stay approved, or withdraw from the event (see section 6.6). After the slot is reserved, contact the organizer.

### 4.4 Payment
- View the organizer's payment instructions, the amount due, and the payment deadline
- Pay the organizer directly and upload proof of payment (section 6)
- View payment status

### 4.5 Participation
- Track upcoming events joined
- See the organizer's contact details for each event applied to
- Receive email notifications (section 8.1)

### 4.6 Vendor dashboard
The vendor dashboard (`/vendor`) shows:
- **Needs your action:** for example, a payment that is due, with the amount, slot, deadline, and a link to upload proof.
- **Applications:** a table of the vendor's events with the status, slot, payment, and the next action (View, Pay, Withdraw, Apply again). The status shown combines the application, slot, and payment: Submitted, Declined (with the organizer's note), Approved (no slot yet), Slot assigned, Reserved, Withdrawn, or Removed.
- **Next event:** the vendor's next event with a reserved slot ("You're confirmed"), with the slot, the organizer's contact, the ingress details, and the vendor floor plan.
- **Open to vendors:** events open to vendors that accept the vendor's categories, with their applications close date.

The application page (`/vendor/applications/[id]`) shows a progress timeline: applied, approved, slot assigned, pay and upload proof, slot reserved. Until a slot is assigned, it also shows the vendor's preferred slot, if they chose one.

## 5. Slot assignment

**The organizer assigns every slot.** In events set to "Vendors choose a preferred slot" (section 3.4), the vendor's preference is a request the organizer usually follows, not a booking. Vendor self-booking (taking or holding a slot without the organizer) is a later feature (section 9).

1. The vendor applies, and the organizer approves the application.
2. The organizer sees the list of approved vendors without a slot, with each one's preferred slot, and assigns each one to an open slot. When the preferred slot is still open, the **Assign slot** dialog selects it. When it was assigned to someone else, the dialog says "Preferred slot taken" and the organizer picks another.
3. The vendor gets an email with the slot, the amount due, the payment instructions, and the deadline (section 6).

Rules:
- A vendor must have an approved application before being assigned a slot.
- A slot has these states: `open` → `assigned` → `reserved` (payment approved). It returns to `open` if the vendor releases it or is removed.
- A slot belongs to one vendor at a time.
- Several vendors can prefer the same slot. The organizer sees "Preferred by 2" on that slot and decides who gets it. The others are assigned elsewhere or stay without a slot.
- A preferred slot that the organizer later deletes shows as "No longer available" on the application. The organizer assigns another.
- A vendor can hold up to the event's slots-per-vendor limit (decision P2), and no more than they asked for. A vendor's slots are one unit (decision P3): the organizer assigns them in one step, and they have one amount (the sum of the slot prices, locked when assigned), one deadline, one payment, and one proof. They are released, removed, or swapped together (decision P6), and shown as one line ("B-03, B-04").
- A set-aside slot can't be assigned (section 3.4).
- There is no "move" feature. To change a vendor's slot, the organizer removes the vendor from the slot, which returns it to `open`, and then assigns another.
- No waitlist: when no slots are open, approved vendors simply have no slot. The organizer sees them in the "approved, no slot" list and can assign them if a slot opens.
- Assignment works the same before and after the event is announced.

## 6. Payments (manual, outside the platform)

Creavent does not process, hold, or refund money. The organizer and vendor handle payment and any disputes between themselves.

### 6.1 Organizer setup (per event)
- **Payment options:** the organizer adds one or more options where vendors can send payment, each with a channel (GCash, Maya, bank transfer, other), an account name and number, an optional QR code image, and notes (for example, "GCash, Joanna L." or "BPI bank transfer"). There is no restriction to GCash or bank. At least one option is needed to open the event to vendors.
- **Price:** vendors pay the **full slot price**. Deposits are not in the MVP (see section 9).
- **Payment deadline:** default is **24 hours** from when the slot is assigned. The organizer can set a different number of hours for the event. The deadline never runs past the event start (the opening of the first day).
- Payment instructions are shown to a vendor right after they are assigned a slot.
- **Locked at assignment:** when a slot is assigned, its price and the payment instructions are copied onto the assignment. If the organizer later changes the price or the payment details, only new assignments use the new values. A vendor who already has a slot always sees the amount and account they were given.

### 6.2 Vendor flow
1. Receive a slot. The deadline is shown ("Pay by Sat, 3 Jan, 6:00 PM").
2. See the amount due, the instructions, and the deadline.
3. Pick one of the organizer's payment options, pay outside the platform, and upload proof of payment (image). With the proof, the vendor selects the option they paid with (required), and enters the amount sent (pre-filled with the amount due) and an optional reference number. Each option has a copy button for the account number.
4. Wait for the organizer's decision.

### 6.3 Organizer review
- Review the proof image against the amount due, with the payment option the vendor paid with, and the amount and reference number they entered. The screen reminds the organizer to check that account's history (for example, their GCash) for the reference before approving
- Approve → slot becomes `reserved`
- Reject, with a reason → the vendor can upload new proof. The reason should say what to fix (for example, "short by ₱100" or "screenshot is unreadable").
- **Mark paid (approve without proof):** the organizer can mark a payment as approved without a proof image (for example, cash paid on site, or paid by someone else), with a required note such as "Paid cash at the office". The slot becomes `reserved`.
- Track which vendors have paid

### 6.4 Payment statuses and the deadline
`pending` (no proof yet) → `submitted` (proof uploaded) → `approved` | `rejected`.
- **The deadline is shown, not enforced.** Nothing expires on its own. When the deadline passes and the payment is still `pending` or `rejected`, the organizer sees it marked **Overdue**. The organizer decides what to do: wait, or remove the vendor (section 6.6), which returns the slot to `open`.
- There are no reminder emails, retry windows, or deadline extensions in the MVP. An organizer who wants to give more time simply does not remove the vendor.

### 6.5 Visibility
Proof-of-payment images are visible to the vendor who uploaded them, the organizer of that event, and admins. No one else can see them.

### 6.6 Cancellations, withdrawals, and removal
Cancellation and withdrawal rules (refunds, notice periods) are decided by each organizer and written in their event policy. Creavent does not set or enforce them. The platform only provides a way to release a slot and a way to remove a vendor.

- **Release a slot:** a vendor whose slot is assigned (payment not yet approved) can always release it. Organizers cannot turn this off. The slot returns to `open` and the organizer is notified by email. A vendor with several slots releases all of them together (decision P6).
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

- Browse upcoming announced events on the event listing, sorted by date (soonest first), and filter by event type, location, and date range (section 7.3). Events that are only open to vendors are not shown.
- View an event page: event type, schedule, location (with a "Get directions" link), description, organizer, the number of confirmed vendors, the public floor plan image (once the organizer uploads it and the event is announced), and when the details were last updated ("Details updated Tue, Nov 10"). A "Copy link" button helps share it.
- See the list of accepted vendors on the event page (vendors with a `reserved` slot only), with the category they sell under at this event and their slot number. The list can be filtered by category, and long lists show the first vendors with "Show all". Each name links to that vendor's page (section 7.2). If a vendor's page is not shown (suspended or deleted), the name stays in the list without a link, and a deleted account shows "Deleted user".
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

### 7.2 Vendor page

Every vendor has a public page (`/vendors/[slug]`), so attendees can get to know who is selling. There is still no vendor directory or vendor search in the MVP.

**Shown on the page:**
- Avatar, shop name, product categories, and about text (`description`)
- Products (free text) and up to 8 vendor photos
- Social media links (optional)
- City, when they joined Creavent, and the number of events they have sold at (the events in "Where they've sold")
- **Find them next at:** the vendor's next upcoming event, with the slot number. Only an event that is `announced` and where the vendor's slot is `reserved` is shown.
- **Where they've sold:** only events where the vendor had a `reserved` slot and the event was announced (status `announced` or `completed`). Events that are `draft` or `open to vendors`, or that were canceled before being announced, are never shown. Hidden events (section 2) are never public, so they are not listed either. Events canceled after being announced are not shown either, because the vendor did not sell at an event that never took place.
- Report button (signed-in users)

**Never shown publicly:** phone number, email, applications, application documents, payments, and events the vendor applied to but did not get a reserved slot at.

The vendor edits the page from their vendor profile (section 4.1). There is no contact form and no messaging. Reports go through the support email address (attendees) or the report button (signed-in users), like organizer pages. The page is not shown while the vendor role is suspended or the account is deleted.

**Page links (slugs)** for vendor, organizer, and event pages: lowercase letters, numbers, and hyphens, 3 to 40 characters. Reserved words (such as `new` and `admin`) are blocked. When the generated slug is taken, a number is added. Slugs can be edited, and the old link redirects to the new one.

**Vendors are told their profile is public.** Onboarding says so (section 1.1), and the terms of use say so too (see [Legal](legal.md)).

### 7.3 Event listing

The home page (`/`) lists upcoming announced events, soonest first. Attendees can search by event name, venue, address, city, or organizer name (decision Q5), and filter by event type (All, Flea markets, Bazaars, Pop-ups), city, and date range. The type options are All plus the active event types, each with its number of events. The date options are Any date, This weekend, Next 2 weeks, the next month (for example, December), and Pick dates. A multi-day event matches a date filter when any of its days falls in the range (section 3.1.1).

- **List and Calendar views**, switched with a toggle.
  - **List** groups events as This weekend, Next weekend, and Later. The weekend is Saturday and Sunday. Events on other days of the current week go under Later. A multi-day event goes under a weekend when any of its days is that Saturday or Sunday (a Friday to Sunday market is under that weekend), and it is listed once, by its first day.
  - **Calendar** is a month grid with today marked, events shown in each day (a multi-day event shows on every one of its days), and a panel that lists the selected day's events. On phones, it is a compact month with dots on event days, and the selected day's events are listed below it.
- **"Next 7 days" strip** beside the page title: the next 7 days with today marked, a mark on days that have announced events (counting every day of a multi-day event), and a link to the calendar.
- **"Sell at these events"** link to sign up as a vendor, showing how many events are open to vendors. Signed-out visitors see the number only (no names or details), because the events themselves stay hidden until announced. For a signed-in vendor the link goes to Browse events.
- Each event card and row shows the event type tag.

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
| Event hidden by an admin | Organizer (includes the reason) |

### 8.2 Contact between organizers and vendors
- There is no in-app messaging in the MVP. Organizers and vendors talk outside Creavent (phone, SMS, Messenger).
- Signed-in vendors see the organizer's contact details for the event (`vendor contact details` on the event, section 3.1). Attendees never see them.
- Vendors who applied also see the organizer's name, mobile number, and contact email on their application page.
- The organizer sees the contact number of each vendor who applied to their event.

## 9. Out of scope for the MVP

- Identity verification (government ID, selfie) for organizers and vendors. Replaced by organizer approval (section 2.1) until the legal review is done
- Vendor self-booking: taking or holding a slot without the organizer, first come first served. Vendors can only state a preferred slot, and the organizer assigns every slot (section 5)
- Floor plan editor (drawing slots, walkways, and areas) and clickable floor plans. Replaced by uploaded floor plan images
- Payment deadline enforcement: automatic expiry, reminder emails, retry windows, and deadline extensions
- In-app messaging between organizers and vendors
- Attendee accounts: saving events, following events and organizers, and their emails
- Admin "view as this user", acting on behalf of users, and admin pages for categories, event types, and settings
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
- A vendor directory, vendor search, and product catalogs (each vendor has a public page with free-text products, section 7.2)
- Attendee messaging or contact forms to reach organizers
- Organizer analytics and platform success dashboards (page views, follows, conversion)
- Ratings and reviews
- Push and SMS notifications
- Recurring events and event series
- Single-day slots or prices in multi-day events, different hours on different days, events past midnight, and events on non-consecutive dates (section 3.1.1)

## 10. Decisions and open questions

### Decided
- **MVP simplification (2026-11-12):** identity verification, vendor slot selection, the floor plan editor, deadline enforcement, messaging, attendee accounts, admin extras, the automatic freeze, self-serve account closing, HEIC, multiple image sizes, and bounce tracking are deferred (section 9).
- Organizers are approved by an admin from their social media and past event links. No documents are uploaded. Vendors need no approval (section 2.1).
- The badge reads "Approved by Creavent" and links to what it means. No "verified" wording.
- Vendors upload permits and documents when applying. Requirements are shown only to signed-in vendors.
- Slots are a list, filled by organizer assignment. The organizer can let vendors choose a preferred slot when applying (section 3.4). Floor plans are two optional images: one for vendors (empty slots) and one for attendees (vendors placed).
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
- A vendor can hold several slots at an event, up to the organizer's limit (default 1). They are assigned, paid, and released together.
- Slots can have different sizes and prices.
- No slot-move feature. To change slots, the organizer removes and reassigns.
- No cap on applications. When slots are full, the organizer can still approve applications.
- Declined vendors can reapply. Removed vendors can reapply only if the organizer allows it.
- The accepted-vendors list shows reserved vendors only.
- The event listing is sorted by date, with filters by event type, location, and date (section 7.3).
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
- Events run 1 to 7 days in a row with the same hours every day. Vendors are locked in for the whole event, with one set of slots, one price, and one payment (section 3.1.1).
- A suspended organizer's upcoming events are hidden by an admin, who emails affected vendors.
- One account can hold the vendor role, the organizer role, or both.
- Files are stored in Cloudflare R2 through the S3 SDK, and the API on Render handles every upload (section 11). Event covers, organizer logos, avatars, vendor photos, and floor plan images are public. Proofs of payment, payment QR codes, and application documents are private.
- Browsers upload straight to storage with short-lived signed URLs. The API checks and re-encodes every file before it is used. Originals are not kept.
- Images accepted: JPEG, PNG, and WebP. Documents may also be PDF. Maximum size is 5 or 10 MB depending on the purpose (section 11.1). Event covers are 16:9.
- No virus scanning in the MVP. PDFs are only allowed in private purposes and are served as downloads.
- Organizers can approve a payment without a proof image, with a required note (for example, cash on site).
- Vendors can withdraw an application while it is `submitted` or `approved` (an unpaid slot is released with it), change their preferred slot until a slot is assigned, and pick another slot while the assigned one is unpaid (decided 2026-11-15).
- Users close their account by emailing support (section 1).
- Payment records, proofs, payment QR images, and application documents are deleted 90 days after the event.
- Changes to event date, time, or location are not kept as a history. They only send emails.
- The technical setup is in [Architecture](architecture.md).
- Every organizer has a public organizer page (section 7.1).
- Users accept the terms and privacy notice and confirm the minimum age at signup. Acceptances are recorded per version (section 1).
- **Design decisions (2026-11-12):**
  - Every vendor has a public page at `/vendors/[slug]` (section 7.2), with social media links and an editable page link. There is still no vendor directory or search. Vendors are told in onboarding and in the terms that their profile is public. This replaces the earlier rule that vendor pages were not public.
  - Each event has one event type (Flea market, Bazaar, or Pop-up), managed in seed data. Flea markets stay the MVP focus. Attendees can filter by type (sections 3.1, 7.3).
  - The event listing has List and Calendar views, a "Next 7 days" strip, and a "Sell at these events" link (section 7.3).
  - Signup asks which role the user wants. This only pre-selects the role in onboarding, and the log in page offers vendor and organizer entry points (section 1).
  - Vendors and organizers each have a 4-step onboarding with saved progress (section 1.1).
  - The logo is the "Market grid" mark (see [Project details](project-details.md#brand)).
- **Mockup alignment (2026-11-12):** the docs were checked against the "Creavent UI Mockup (MVP)" screens and updated to match (see [Open questions](open-questions.md#k-mockup-alignment)):
  - Events can have an applications close date, and optional ingress details for vendors (sections 3.1, 3.3).
  - Slots have an optional note, and can be added a row at a time (section 3.4).
  - A required document can apply to one category only (section 3.2).
  - The "Open to vendors" checklist has five required steps, and event setup has "Preview as vendor" (section 3.1).
  - Vendors enter the amount sent and an optional reference number with their proof (section 6.2).
  - The organizer dashboard, vendor dashboard, and event page contents follow the mockup (sections 3.8, 4.6, 7, 7.3).
  - Suspension is per role with a reason shown to the user, hiding an event emails the organizer the reason, and admins add reports from the support inbox (sections 2, 2.1, 2.2).
  - The links an organizer submits for approval are their public social links (section 2.1).
- **Multi-day events and payment options (2026-11-12):** events run 1 to 7 days in a row with the same daily hours, and vendors are locked in for the whole event (section 3.1.1). Vendors select which payment option they paid with when uploading proof (section 6.2). See [Open questions](open-questions.md#l-multi-day-events-and-payment-options).
- **Event policy prefill (2026-11-14):** a new event copies the policy of the organizer's most recent event. A first event starts from an example to edit. No global policy setting (section 3.7). See [Open questions](open-questions.md#n-event-policy).
- **Deleting events (2026-11-15):** only drafts can be deleted, for good. Events that were opened to vendors are canceled instead, never deleted (section 3.1).
- **Event cover crop (2026-11-15):** one cover per event, framed by the organizer at 16:9 in a crop step after picking the photo. The same frame shows on event cards and the event page (16:9 at every width). No separate thumbnail or banner upload (section 11.5).
- **Preferred slots (2026-11-14):** each event has a slot mode, "I assign slots" or "Vendors choose a preferred slot". A preference holds nothing, and the organizer still assigns every slot (sections 3.4, 4.3, 5). Slots get an optional section for grouping. The vendor floor plan is uploaded on the Slots tab and shown there as a reference. Prompted by an organizer's registration form with a clickable floor plan. See [Open questions](open-questions.md#m-preferred-slots).

### Open
1. Confirm the record retention period (90 days) and data handling with a lawyer under the Philippine Data Privacy Act, including health certificates uploaded as permits.
2. No other open questions. The follow-up questions from the 2026-11-12 design decisions (J1 to J12) were decided the same day and are listed in [Open questions](open-questions.md#j-public-pages-onboarding-and-event-types).

## 11. File uploads

Every upload follows the same rules. The tables behind it are in the [Data model](data-model.md#52-files).

### 11.1 What can be uploaded

"Image" means a still JPEG, PNG, or WebP photo. HEIC, GIF, SVG, and animated files are not accepted. Logos and avatars are asked for in onboarding (section 1.1) and are defined in this table.

| Purpose | Used for | Uploaded by | Who can open it | Types | Max size | Limit |
|---|---|---|---|---|---|---|
| Event cover | Banner and card image of an event (3.1) | The event's organizer | Anyone (public) | Image | 10 MB | 1 per event |
| Organizer logo | Organizer's public profile (3.1) | The organizer | Anyone (public) | Image | 5 MB | 1 |
| Avatar | A user's picture, shown on the vendor page (7.2) | The user | Anyone (public) | Image | 5 MB | 1 |
| Vendor photo | Vendor profile and vendor page (4.1, 7.2) | The vendor | Anyone (public) | Image | 10 MB | 8 per profile |
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
3. **Complete.** The browser tells the API it is done, with the 16:9 frame the organizer chose for an event cover (section 11.5). The API reads the uploaded file, runs the checks and processing in sections 11.4 and 11.5, writes the final file to the right bucket, deletes the `incoming/` copy, and marks the record `ready`. If any check fails, the record and the upload are deleted and the user sees a clear reason (for example, "This file is over 10 MB" or "This photo is too small. Use at least 1280 x 720").
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
| Event cover | Up to 1600 x 900. The organizer frames it at 16:9 in a crop step after picking the photo (drag to move, zoom in down to a 1280 x 720 part of the photo). Without a frame, it is cropped to 16:9 from the center. |
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

Virus scanning, keeping original files (so reframing a cover means uploading the photo again), HEIC, multiple sizes per image, a crop step for pictures other than the event cover, separate thumbnail and banner images, video, and GIF or animated images.
