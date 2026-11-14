# Creavent MVP User Flows

**Status:** First draft. Kept simple on purpose: the main path for each task, plus the edge cases ordinary users are likely to hit. The rules behind each step are in the [Feature specification](feature-specification.md). If this file and the spec disagree, the spec wins.

Last updated: 2026-11-14

Acceptance criteria are written per flow as each phase is built. Flows 1, 2, and the approval part of 11 have them (Phase 1). Each criterion has a test in `apps/api/test/integration` or next to the screen in `apps/web/src`.

## How to read this

- Each flow lists the main steps in order.
- **Edge cases** say what the user sees and what happens. "Spec §X" points to the rule.
- Edge cases marked **(screen)** are wording or screen behavior only, with no new rule.

## Flow overview

| # | Flow | Who |
|---|---|---|
| 1 | Sign up and onboarding | Vendors and organizers |
| 2 | Get approved as an organizer | Organizer |
| 3 | Create an event and open it to vendors | Organizer |
| 4 | Find an event and apply | Vendor |
| 5 | Review applications | Organizer |
| 6 | Assign a slot | Organizer, vendor |
| 7 | Pay and confirm payment | Vendor, organizer |
| 8 | Announce the event | Organizer |
| 9 | Release, remove, change, or cancel | Vendor, organizer |
| 10 | Discover events and vendors | Attendee |
| 11 | Approve organizers, handle reports, suspend | Admin |

The full path to a confirmed spot: **1 → 2 → 3 → 4 → 5 → 6 → 7 → 8.** Vendors skip flow 2.

---

## 1. Sign up and onboarding

**Sign up**
1. On `/signup`, the user first picks "I'm signing up to: **Sell at events** (vendor account) or **Run events** (organizer account)". On `/login`, the **Create a vendor account** and **Create an organizer account** links lead here with the same choice.
2. The user signs up with Google, or with their full name, email, and a password. They accept the terms and privacy notice and confirm "I'm 18 or older". Then they verify their email from the link sent to their inbox.
3. The choice in step 1 only pre-selects the role in onboarding. No role exists until onboarding step 1.

**Onboarding (spec §1.1).** It starts after the email is confirmed. Every step shows "Step N of 4", and progress is saved. The user can tap **Finish later** and continue from the same step.

*Both roles:* step 1 is **"How will you use Creavent?"** (vendor, organizer, or both), pre-selected from signup.

*Vendor (4 steps)*
1. Role.
2. Shop: shop name (required), product categories (pick all that apply), about your shop (optional), products (optional).
3. Photos (can be skipped): an avatar or logo, and up to 8 product photos. The step says these are public on the vendor page.
4. Contact: mobile number (required, shown to organizers on applications, never on the public page), and social media links (optional, public).
5. **Done:** a preview of the vendor profile with a link to the public page, events open to vendors that accept their categories, and a "Finish your profile" checklist. Vendors can now apply to events. Permits are not saved to the profile: they are uploaded with each application (flow 4).

*Organizer (4 steps)*
1. Role.
2. Organizer page: display name (required), page link (editable), logo (optional), city, about (optional).
3. Contact: mobile number (required), contact email (required for approval, can differ from the login email).
4. Get approved: at least one link to social media pages or past event posts (these also show on the organizer page), a "What we check" list, the 1 to 2 business day review target, and two buttons: **Submit for review** or **Do this later**.
5. **Submitted:** the status is "Pending review", with a short timeline (submitted, reviewed, approved), a "Create your first event as a draft" next step, a preview of the organizer page, and the support email. With **Do this later**, approval stays at `not submitted` and the organizer can still create drafts (flow 2 covers the review).

With both roles, a switch moves the user between the vendor and organizer dashboards.

**Edge cases**
- **The user leaves onboarding half-way (Finish later, or closes the tab):** next time they continue from the step they stopped at. Spec §1.1.
- **The user picks a different role in step 1 than at signup:** the step 1 answer wins. The signup choice only pre-selects. **(screen)**
- **The user picks both roles:** the vendor flow runs first, then the organizer flow. Step 1 is shown once, and each flow shows its own "Step N of 4". Spec §1.1.
- **The user finished onboarding late and tries to act too early:** a vendor can't apply until the shop name, mobile number, and a product category are set, and an organizer can't create an event until the display name and mobile number are set. The screen sends them back to the missing step. Spec §1.1. **(screen)**
- **The vendor skips the photos step:** the "Finish your profile" checklist reminds them later. **(screen)**
- **Verification link expired:** the user sees "This link has expired" and a button to send a new one. **(screen)**
- **Forgot password:** the user asks for a reset link by email, then sets a new password. The link expires. **(screen)**
- **Signs in with Google using an email that already has an account:** it opens the same account, not a new one. If that account's email was never verified, Google verifies it and the old password stops working. Spec §1.
- **The terms or privacy notice changed since they last signed in:** they see the new version and accept it before continuing. Spec §1.
- **Email typo at signup:** the email isn't verified, so the account stays unconfirmed until the user fixes it. **(screen)**

**Acceptance criteria (Phase 1)**
- Signup needs a full name, a valid email, a password of 8 to 128 characters, "I'm 18 or older", and the terms and privacy acceptance. Both agreements are recorded with the current versions, and the age confirmation with its time.
- After signup the user sees "Check your inbox" and can send the link again. They can't log in until the email is confirmed. The link works for 24 hours, signs them in, and opens onboarding with the signup choice pre-selected.
- An expired or used link shows "This link has expired" with a way to send a new one.
- An email that already has an account is told so, with a Log in link.
- Log in with a wrong password says "Wrong email or password." 5 failed tries for one email, from any address, lock that email for 15 minutes; a password reset lifts the lock. Each address is also rate limited.
- Forgot password always answers the same way, whether or not the email has an account. The reset link works for 1 hour, once, and signs the user out everywhere.
- A Google signup, or a user whose accepted terms or privacy version is older than the current one, sees `/account/legal` before any other page.
- Google sign-in with the email of an account that was never confirmed opens that account, confirms the email, and removes its password.
- Onboarding step 1 adds the chosen roles (organizers start at `not_submitted`). Each step saves its fields, the furthest step per role is kept, and the user continues from there. With both roles, the vendor flow runs first.
- Vendor: shop name and at least one category are required, the about text is at most 300 characters, the page link comes from the shop name (a number is added if taken), photos can be skipped, and the mobile number must be a Philippine mobile number. Only the user's own ready files of the right kind can be attached.
- Organizer: the page link is checked against taken and reserved words, and the mobile number and contact email are required before a review can be requested.
- The vendor done screen shows the profile preview and the "Finish your profile" checklist. The organizer done screen shows "Pending review" and the timeline, or a nudge to get approved after "Do this later".

## 2. Get approved as an organizer

*This is step 4 of organizer onboarding (flow 1). An organizer who chose "Do this later" starts here from `/organizer/approval`.*

1. The organizer fills in their organizer profile and opens "Get approved".
2. They add a contact number and email, and links to their social media pages and past event posts (at least one link). The links also show on their organizer page.
3. Status changes to **Pending review**. The page says reviews usually take 1 to 2 business days.
4. The admin approves → status is **Approved**, the "Approved by Creavent" badge appears, and an email is sent.
   The admin rejects → the organizer sees the reason and can resubmit.

**Edge cases**
- **No social media or past events to show:** the admin may contact the organizer before deciding, or reject with a reason like "Add a page that shows your past events". Spec §2.1.
- **An organizer who isn't approved tries to open an event:** the button is disabled with "Get approved to open this event to vendors". They can keep editing the draft. Spec §3.1.
- **A rejected organizer disagrees:** they resubmit with better links or email support. Spec §2.1.

**Acceptance criteria (Phase 1)**
- Submit for review needs at least one link, saves the links on the organizer page, and sets the status to `pending_review`. "Do this later" saves the links and leaves it at `not_submitted`.
- A rejected organizer sees the reason and can resubmit, which clears it. An approved or pending organizer can't request again.
- While a review is pending or after approval, the display name, page link, and links can't be changed through onboarding (open question D9).

## 3. Create an event and open it to vendors

*Organizer. Works on a phone.*

1. Create a draft: name, event type (Flea market, Bazaar, or Pop-up; Flea market is pre-selected), dates and daily hours (1 to 7 days in a row, same hours each day, for example Fri to Sun, 4 PM to 10 PM), location, description, cover image, contact details for vendors, and optionally an applications close date and ingress details (for example, "From 3 PM, Gate 2").
2. Set vendor requirements: allowed product categories, limits on similar vendors, required permits (each for every vendor, or for one category only).
3. Check the cancellation and withdrawal policy. It is copied from the organizer's last event. On a first event, edit the example and save it.
4. Optional: upload the vendor floor plan image (layout with empty, numbered slots) at the top of the Slots tab. It stays next to the slot list as a reference while adding slots.
5. Add slots: optional section (for example, Indoor or Outdoor), number, size, optional note, and price (one price for all slots, or per slot). **Add a row of slots** creates a numbered range at once (for example, C-01 to C-06). Choose how slots are filled: **I assign slots** (the default) or **Vendors choose a preferred slot**.
6. Add one or more payment options (for example, GCash and a bank account, each with account details or a QR code) and the payment deadline (24 hours by default).
7. Optional: **Preview as vendor** to check what vendors will see.
8. **Open the event to vendors.** Vendors can now find it and apply. Attendees can't see it yet.

**Edge cases**
- **Required setup is missing:** the "Open to vendors" checklist shows "4 of 5 required steps done" and lists what's missing (name, date, venue and cover; requirements; policy; at least one slot; payment instructions). **(screen)**
- **Organizer edits the policy after vendors applied:** vendors who already applied keep the version they accepted. New applicants see the new one. Spec §3.7.
- **Organizer changes the price or GCash number after slots are assigned:** only new assignments use the new values. Vendors who already have slots keep what they were shown. Spec §6.1.
- **Organizer tries to delete or rename an assigned or reserved slot:** blocked with "Remove the vendor from this slot first". Spec §3.4.
- **The market runs Friday to Sunday:** the organizer sets a start and end date. Each slot covers all three days and is paid once. Vendors can't book a single day. Spec §3.1.1.
- **The hours differ on Sunday, or the market runs past midnight:** not supported. The organizer uses the main hours and explains the difference in the description. Spec §3.1.1. **(screen)**
- **Slot numbers on the image don't match the slot list:** the system doesn't check. The organizer fixes the image or the list. **(screen: the upload step reminds them)**
- **Vendors choose a preferred slot, but there's no floor plan image:** vendors still pick from the list, grouped by section with size and note. The Slots tab suggests uploading one. **(screen)**
- **Organizer switches to "I assign slots" after some vendors chose a preference:** those preferences are kept and still shown when assigning. New applicants don't see the choice. Spec §3.4.

## 4. Find an event and apply

*Vendor, mobile-first.*

1. Browse upcoming events (open to vendors or already announced). Filter by date and location. Each event shows the vendor's remaining spots in their categories, when the organizer set a limit.
2. Open an event: type, date, location, the applications close date, requirements (accepted categories with spots left, and the documents to upload), slots grouped by section with prices and how many are open, vendor floor plan, policy, organizer contact details, and the "Approved by Creavent" badge.
3. Tap **Apply**. Pick the categories and upload the required permits. If the organizer lets vendors choose, pick a preferred slot from the floor plan and the list of open slots, or "No preference". Applying means the vendor accepts the event policy.
4. Status shows **Submitted**. The vendor waits for the organizer.

**Edge cases**
- **Vendor's product category isn't allowed at this event:** the event page says which categories are accepted before they apply. **(screen)**
- **Applications are closed (by the organizer, or the close date passed):** "Apply" is replaced with "Applications closed". The vendor can still contact the organizer with the details on the page. **(screen)**
- **Vendor changes their mind before a decision:** they withdraw the application, and the organizer gets an email. They can apply again later. Spec §4.2.
- **Vendor was declined before:** they can apply again. Spec §3.3.
- **Vendor was removed before:** they can apply again only if the organizer allowed it. Otherwise they see "You can't reapply to this event". Spec §3.3.
- **The slot they want is taken:** it shows as Taken and can't be picked. They pick another or "No preference". Spec §4.3.
- **Another vendor prefers the same slot:** both can pick it, and neither sees the other's choice. The organizer decides. Spec §5.
- **Vendor wants a different preferred slot after applying:** it can't be edited. They contact the organizer, or withdraw and apply again while the application is still submitted. Spec §4.3.

## 5. Review applications

*Organizer.*

1. An email arrives: "New application".
2. Open the application: the vendor's profile, contact number, categories, permits, and preferred slot (if the event lets vendors choose). A counter shows category fill, for example "Food: 4 of 5 accepted".
3. **Approve** or **Decline**, with an optional note. The vendor gets an email.

**Edge cases**
- **The category limit is already reached:** the counter shows it, but the organizer can still approve. The system doesn't auto-reject. Spec §3.2.
- **All slots are taken:** the organizer can still approve, in case a slot opens later. Spec §3.3.
- **Organizer closes applications with some still waiting:** the waiting ones can still be reviewed. **(screen)**
- **A permit looks wrong or is missing:** the organizer declines with a note, or contacts the vendor first. **(screen)**

## 6. Assign a slot

*The vendor's application must be approved first.*

1. The organizer opens the "Approved, no slot" list and assigns each vendor to an open slot. A vendor's preferred slot is selected for them when it's still open.
2. The vendor gets an email with the slot number, amount, payment instructions, and deadline (flow 7).

**Edge cases**
- **No slots are open:** the vendor stays in the "Approved, no slot" list. The vendor sees "No slot assigned yet". There's no waitlist. Spec §5.
- **Vendor needs a different slot:** the organizer removes them from the slot and assigns another. There's no "move" button. Spec §5.
- **Vendor already has a slot:** they can't be assigned a second one at the same event. Spec §5.
- **The preferred slot was given to someone else:** the Assign slot dialog says "Preferred slot taken: E-11", and the organizer picks another. Spec §5. **(screen)**
- **Two vendors prefer the same slot:** the slot shows "Preferred by 2". The organizer assigns one, and the other's preferred slot then shows as taken. Spec §5. **(screen)**

## 7. Pay and confirm payment

*Payment happens outside Creavent. The app only tracks proof.*

**Vendor**
1. The payment screen shows the amount due, the organizer's account details or QR code (with copy buttons), the deadline ("Pay by Sat, 3 Jan, 6:00 PM", and the time left), and a notice that Creavent doesn't hold or guarantee payments.
2. The vendor pays using one of the organizer's payment options (for example, GCash or a bank transfer).
3. The vendor uploads a screenshot of the payment, selects the option they paid with, and enters the amount sent and an optional reference number. Status: **Submitted**.

**Organizer**
4. An email arrives: "Proof of payment uploaded".
5. The organizer sees which option the vendor paid with, compares the screenshot with the amount due, and checks the reference number in that account's history.
6. **Approve** → the slot is **Reserved**, and the vendor appears on the accepted-vendor list.
   **Reject** with a reason → the vendor can upload new proof.

**Edge cases**
- **Blurry or wrong screenshot:** the organizer rejects it with "Screenshot is unreadable". The vendor re-uploads. Spec §6.3.
- **Vendor paid too little (₱400 of ₱500):** the organizer rejects it with "Short by ₱100". The vendor sends the rest and uploads a screenshot of the second payment. Spec §6.3.
- **Deadline passes with no proof:** nothing happens on its own. The organizer sees the payment marked **Overdue** and can wait or remove the vendor (flow 9). Spec §6.4.
- **Vendor needs more time:** they contact the organizer, who simply doesn't remove them. Spec §6.4.
- **Vendor paid in cash, or someone else paid for them:** the organizer taps **Mark paid** (approve without a proof image) and adds a required note, for example "Paid cash at the office". Spec §6.3.
- **The organizer's payment details looked suspicious:** the vendor can report the organizer with the report button. Spec §6.6.

## 8. Announce the event

*Organizer.*

1. The organizer checks the vendor list.
2. Optional: upload the public floor plan image (layout with vendors placed).
3. Tap **Announce**. The event appears in attendee discovery.

**Edge cases**
- **Some slots are still unpaid when announcing:** a warning lists them, for example "3 slots not yet paid". The organizer can still announce. **(screen)**
- **A reserved vendor drops out after the announcement:** the organizer removes them (flow 9), assigns the slot to another approved vendor or leaves it empty, and uploads an updated public floor plan if needed. Spec §5.

## 9. Release, remove, change, or cancel

**Vendor releases an assigned slot (not yet paid and approved)**
1. Tap **Release** → confirm. The slot opens again, and the organizer gets an email. Organizers can't turn this off.

**Vendor wants out after the slot is reserved**
1. The vendor contacts the organizer using the contact details on the event.
2. The organizer decides under their own policy and removes the vendor if they agree. Refunds happen between the two of them.

**Organizer removes a vendor**
1. Tap **Remove** on the vendor → choose whether they can reapply → confirm.
2. The slot opens again, and the vendor gets an email. Payment records are kept read-only for both sides.

**Organizer changes date, time, or location**
1. Edit the event → save. Applied and confirmed vendors get an email.

**Organizer cancels the event**
1. Tap **Cancel event** → confirm. Applied and confirmed vendors get an email. Refunds happen outside Creavent.

**Edge cases**
- **Vendor released by mistake:** the slot is open again. They contact the organizer, who can assign it to them again. **(screen: the confirm step says this)**
- **Vendor and organizer disagree about a refund:** Creavent doesn't decide. Both sides can still download the payment records as evidence. Spec §6.6.
- **Vendor is removed and wants their screenshots:** they can still view and download them until 90 days after the event. Spec §6.7.

## 10. Discover events and vendors

*Attendee. No account.*

1. Open Creavent → see upcoming announced events, soonest first. Switch between **List** (This weekend, Next weekend, Later) and **Calendar**, and use the "Next 7 days" strip. A Friday to Sunday market shows on each of its days in the calendar. Filter by event type (All, Flea markets, Bazaars, Pop-ups), location, and date. Spec §7.3.
2. Open an event: type, schedule, location with directions, description, organizer with the "Approved by Creavent" badge, public floor plan image, and the vendor list with each vendor's category and slot number (filter by category).
3. Tap the organizer to open their organizer page: about, social links, upcoming and past events. Spec §7.1.
4. Tap a vendor's name in the vendor list to open their vendor page: shop details, photos, social links, where to find them next, and where they've sold. Spec §7.2.

**Edge cases**
- **Attendee wants to ask a vendor a question:** there's no contact option. The page shows the public details and social links only. Spec §7.2.
- **A vendor's page is not available (the vendor is suspended or the account was deleted):** the page shows "Not found". Spec §7.2. The event's vendor list still shows that vendor's name, without a link. Spec §7.
- **The "Where they've sold" list is empty:** the page shows the profile only. **(screen)**
- **Attendee wants to ask the organizer a question:** there's no contact option in the MVP. The page shows the public details and social links only. Spec §7.
- **Attendee wants to report a fake event:** they email the support address shown on the page. Spec §7.
- **An event link is shared before announcement:** attendees can't see it yet. **(screen: "This event isn't public yet")**

## 11. Approve organizers, handle reports, suspend

*Admin.*

**Organizer approval**
1. Open the approval queue → check the organizer's links and profile → approve, or reject with a reason.


**Acceptance criteria for organizer approval (Phase 1)**
- Only admins can open the queue or decide. The queue lists `pending_review` organizers oldest first, with links count, business days waiting against the 2-day target, and resubmissions marked.
- The detail page shows the links to check, the profile, the contact details, the account, and "N of M in queue" with Next.
- Approve or reject (a reason is required) writes the review, an audit log row with the before and after status, and the approved or rejected email in one transaction. Only a `pending_review` request can be decided.

**Reports**
1. A report arrives from the report button, or the admin adds one from a support email.
2. Open the report (reports on the same event or user are grouped) → look at the user or event → add an internal note → dismiss, hide the event, or suspend the user's role.
3. Hiding an event needs a reason, which is emailed to the organizer.

**Suspending a role**
1. Choose the role to suspend (vendor or organizer) and write a reason. The user sees the reason in the app. The other role keeps working.

**Suspending an organizer with live events**
1. Suspend the organizer role.
2. Hide each of their upcoming events.
3. Email the vendors who applied or have a slot, from the support address.

**Edge cases**
- **A user needs a data fix the admin pages can't do:** the team fixes it directly in the database. Spec §2.
- **A user asks to delete their account:** the team deletes it by hand. Spec §1.
