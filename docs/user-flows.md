# Creavent MVP User Flows

**Status:** First draft. Kept simple on purpose: the main path for each task, plus the edge cases ordinary users are likely to hit. The rules behind each step are in the [Feature specification](feature-specification.md). If this file and the spec disagree, the spec wins.

Last updated: 2026-11-12

User stories with acceptance criteria are not written yet. They can be added per flow once these flows are agreed.

## How to read this

- Each flow lists the main steps in order.
- **Edge cases** say what the user sees and what happens. "Spec §X" points to the rule.
- Edge cases marked **(screen)** are wording or screen behavior only, with no new rule.

## Flow overview

| # | Flow | Who |
|---|---|---|
| 1 | Sign up and add a role | Vendors and organizers |
| 2 | Get approved as an organizer | Organizer |
| 3 | Create an event and open it to vendors | Organizer |
| 4 | Find an event and apply | Vendor |
| 5 | Review applications | Organizer |
| 6 | Assign a slot | Organizer, vendor |
| 7 | Pay and confirm payment | Vendor, organizer |
| 8 | Announce the event | Organizer |
| 9 | Release, remove, change, or cancel | Vendor, organizer |
| 10 | Discover events | Attendee |
| 11 | Approve organizers, handle reports, suspend | Admin |

The full path to a confirmed spot: **1 → 2 → 3 → 4 → 5 → 6 → 7 → 8.** Vendors skip flow 2.

---

## 1. Sign up and add a role

1. The user signs up with Google, or with their name, email, and a password. They accept the terms and privacy notice and confirm they are 18 or older. Then they verify their email from the link sent to their inbox.
2. The user adds a role: **vendor**, **organizer**, or both, and enters a contact number.
3. Vendors can now fill in their profile and apply to events. Organizers continue to flow 2.
4. With both roles, a switch moves the user between the vendor and organizer dashboards.

**Edge cases**
- **Verification link expired:** the user sees "This link has expired" and a button to send a new one. **(screen)**
- **Forgot password:** the user asks for a reset link by email, then sets a new password. The link expires. **(screen)**
- **Signs in with Google using an email that already has an account:** it opens the same account, not a new one. If that account's email was never verified, Google verifies it and the old password stops working. Spec §1.
- **The terms or privacy notice changed since they last signed in:** they see the new version and accept it before continuing. Spec §1.
- **Email typo at signup:** the email isn't verified, so the account stays unconfirmed until the user fixes it. **(screen)**

## 2. Get approved as an organizer

1. The organizer fills in their organizer profile and opens "Get approved".
2. They add a contact number and email, and links to their social media pages and past event posts (at least one link).
3. Status changes to **Pending review**. The page says reviews usually take 1 to 2 business days.
4. The admin approves → status is **Approved**, the "Approved by Creavent" badge appears, and an email is sent.
   The admin rejects → the organizer sees the reason and can resubmit.

**Edge cases**
- **No social media or past events to show:** the admin may contact the organizer before deciding, or reject with a reason like "Add a page that shows your past events". Spec §2.1.
- **An organizer who isn't approved tries to open an event:** the button is disabled with "Get approved to open this event to vendors". They can keep editing the draft. Spec §3.1.
- **A rejected organizer disagrees:** they resubmit with better links or email support. Spec §2.1.

## 3. Create an event and open it to vendors

*Organizer. Works on a phone.*

1. Create a draft: name, date and time, location, description, cover image, contact details for vendors.
2. Set vendor requirements: allowed product categories, limits on similar vendors, required permits.
3. Write the cancellation and withdrawal policy.
4. Add slots: number, size, and price (one price for all slots, or per slot).
5. Optional: upload the vendor floor plan image (layout with empty, numbered slots).
6. Add payment instructions (account details or QR code) and the payment deadline (24 hours by default).
7. **Open the event to vendors.** Vendors can now find it and apply. Attendees can't see it yet.

**Edge cases**
- **Required setup is missing (no payment instructions, no slots, no policy):** "Open to vendors" lists what's missing. **(screen)**
- **Organizer changes the price or GCash number after slots are assigned:** only new assignments use the new values. Vendors who already have slots keep what they were shown. Spec §6.1.
- **Organizer tries to delete or rename an assigned or reserved slot:** blocked with "Remove the vendor from this slot first". Spec §3.4.
- **Slot numbers on the image don't match the slot list:** the system doesn't check. The organizer fixes the image or the list. **(screen: the upload step reminds them)**

## 4. Find an event and apply

*Vendor, mobile-first.*

1. Browse upcoming events (open to vendors or already announced). Filter by date and location.
2. Open an event: date, location, requirements, prices, vendor floor plan, policy, organizer contact details, and the "Approved by Creavent" badge.
3. Tap **Apply**. Upload the required permits. Applying means the vendor accepts the event policy.
4. Status shows **Submitted**. The vendor waits for the organizer.

**Edge cases**
- **Vendor's product category isn't allowed at this event:** the event page says which categories are accepted before they apply. **(screen)**
- **Applications are closed:** "Apply" is replaced with "Applications closed". The vendor can still contact the organizer with the details on the page. **(screen)**
- **Vendor changes their mind before a decision:** they withdraw the application, and the organizer gets an email. They can apply again later. Spec §4.2.
- **Vendor was declined before:** they can apply again. Spec §3.3.
- **Vendor was removed before:** they can apply again only if the organizer allowed it. Otherwise they see "You can't reapply to this event". Spec §3.3.

## 5. Review applications

*Organizer.*

1. An email arrives: "New application".
2. Open the application: the vendor's profile, contact number, categories, and permits. A counter shows category fill, for example "Food: 4 of 5 accepted".
3. **Approve** or **Decline**, with an optional note. The vendor gets an email.

**Edge cases**
- **The category limit is already reached:** the counter shows it, but the organizer can still approve. The system doesn't auto-reject. Spec §3.2.
- **All slots are taken:** the organizer can still approve, in case a slot opens later. Spec §3.3.
- **Organizer closes applications with some still waiting:** the waiting ones can still be reviewed. **(screen)**
- **A permit looks wrong or is missing:** the organizer declines with a note, or contacts the vendor first. **(screen)**

## 6. Assign a slot

*The vendor's application must be approved first.*

1. The organizer opens the "Approved, no slot" list and assigns each vendor to an open slot.
2. The vendor gets an email with the slot number, amount, payment instructions, and deadline (flow 7).

**Edge cases**
- **No slots are open:** the vendor stays in the "Approved, no slot" list. The vendor sees "No slot assigned yet". There's no waitlist. Spec §5.
- **Vendor needs a different slot:** the organizer removes them from the slot and assigns another. There's no "move" button. Spec §5.
- **Vendor already has a slot:** they can't be assigned a second one at the same event. Spec §5.

## 7. Pay and confirm payment

*Payment happens outside Creavent. The app only tracks proof.*

**Vendor**
1. The payment screen shows the amount due, the organizer's account details or QR code, the deadline ("Pay by Sat, 3 Jan, 6:00 PM"), and a notice that Creavent doesn't hold or guarantee payments.
2. The vendor pays through GCash, a bank, or another channel.
3. The vendor uploads a screenshot of the payment. Status: **Submitted**.

**Organizer**
4. An email arrives: "Proof of payment uploaded".
5. The organizer compares the screenshot with the amount due.
6. **Approve** → the slot is **Reserved**, and the vendor appears on the accepted-vendor list.
   **Reject** with a reason → the vendor can upload new proof.

**Edge cases**
- **Blurry or wrong screenshot:** the organizer rejects it with "Screenshot is unreadable". The vendor re-uploads. Spec §6.3.
- **Vendor paid too little (₱400 of ₱500):** the organizer rejects it with "Short by ₱100". The vendor sends the rest and uploads a screenshot of the second payment. Spec §6.3.
- **Deadline passes with no proof:** nothing happens on its own. The organizer sees the payment marked **Overdue** and can wait or remove the vendor (flow 9). Spec §6.4.
- **Vendor needs more time:** they contact the organizer, who simply doesn't remove them. Spec §6.4.
- **Vendor paid in cash, or someone else paid for them:** the organizer approves without a proof image and adds a note, for example "Paid cash at the office". Spec §6.3.
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

## 10. Discover events

*Attendee. No account.*

1. Open Creavent → see upcoming announced events, soonest first. Filter by location and date.
2. Open an event: schedule, location, description, organizer with the "Approved by Creavent" badge, public floor plan image, and the vendor list.
3. Tap the organizer to open their organizer page: about, social links, upcoming and past events. Spec §7.1.

**Edge cases**
- **Attendee wants to ask the organizer a question:** there's no contact option in the MVP. The page shows the public details and social links only. Spec §7.
- **Attendee wants to report a fake event:** they email the support address shown on the page. Spec §7.
- **An event link is shared before announcement:** attendees can't see it yet. **(screen: "This event isn't public yet")**

## 11. Approve organizers, handle reports, suspend

*Admin.*

**Organizer approval**
1. Open the approval queue → check the organizer's links and profile → approve, or reject with a reason.

**Reports**
1. Open a report → look at the user or event → dismiss it, hide the event, or suspend the account.

**Suspending an organizer with live events**
1. Suspend the account.
2. Hide each of their upcoming events.
3. Email the vendors who applied or have a slot, from the support address.

**Edge cases**
- **A user needs a data fix the admin pages can't do:** the team fixes it directly in the database. Spec §2.
- **A user asks to delete their account:** the team deletes it by hand. Spec §1.
