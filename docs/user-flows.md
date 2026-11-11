# Creavent MVP User Flows

**Status:** First draft. Kept simple on purpose: the main path for each task, plus the edge cases ordinary users are likely to hit. The rules behind each step are in the [Feature specification](feature-specification.md). If this file and the spec disagree, the spec wins.

Last updated: 2026-11-11

User stories with acceptance criteria are not written yet. They can be added per flow once these flows are agreed.

## How to read this

- Each flow lists the main steps in order.
- **Edge cases** say what the user sees and what happens. "Spec §X" points to the rule.
- Edge cases marked **(screen)** are wording or screen behavior only, with no new rule.

## Flow overview

| # | Flow | Who |
|---|---|---|
| 1 | Sign up and add a role | Everyone with an account |
| 2 | Get verified | Organizer, vendor |
| 3 | Create an event and open it to vendors | Organizer |
| 4 | Find an event and apply | Vendor |
| 5 | Review applications | Organizer |
| 6 | Get a slot | Vendor, organizer (mode 3) |
| 7 | Pay and confirm payment | Vendor, organizer |
| 8 | Announce the event | Organizer |
| 9 | Withdraw, remove, change, or cancel | Vendor, organizer |
| 10 | Discover and follow events | Attendee |
| 11 | Verify users, handle reports, suspend | Admin |

The full path to a confirmed spot: **1 → 2 → 3 → 4 → 5 → 6 → 7 → 8.**

---

## 1. Sign up and add a role

1. The user signs up with email or Google, then verifies their email.
2. Attendees stop here. They can now save and follow events.
3. To sell or organize, the user adds a role from their account: **vendor**, **organizer**, or both.
4. With both roles, a switch moves the user between the vendor and organizer dashboards.

**Edge cases**
- **Magic link expired or opened on another device:** the user sees "This link has expired" and a button to send a new one. **(screen)**
- **Signs in with Google using an email that already has an account:** it opens the same account, not a new one. Spec §1.
- **Email typo at signup:** the email isn't verified, so the account stays unconfirmed until the user fixes it. If emails bounce later, a banner asks them to update the address. Spec §8.1.

## 2. Get verified

1. The user opens "Get verified" for the role they added.
2. **Vendor:** uploads a government ID and adds a contact number.
   **Organizer:** uploads a government ID and a selfie holding it, adds a contact number and email, and gives one proof of operation (permit, DTI or SEC registration, or social media links or past event posts).
3. Status changes to **Pending review**. The page says reviews usually take 1 to 2 business days.
4. The admin approves → status is **Verified**, and an email is sent.
   The admin rejects → the user sees the reason and can resubmit.

**Edge cases**
- **Already a verified vendor, now adding the organizer role:** the ID check carries over. The organizer only adds the selfie and proof of operation. Spec §1.
- **Blurry or wrong document:** the admin rejects it with a reason like "ID photo is unreadable". The user resubmits, or emails support to contest it. Spec §2.1.
- **A vendor signs up 2 days before a market they want to join:** verification may not finish in time. Event pages show "Verification takes 1 to 2 business days" to unverified vendors. **(screen)**
- **An unverified organizer tries to open an event:** the button is disabled with "Get verified to open this event to vendors". They can keep editing the draft. Spec §3.1.

## 3. Create an event and open it to vendors

*Organizer. The floor plan step is desktop-only.*

1. Create a draft: name, date and time, location, description, cover image, contact details for vendors.
2. Set vendor requirements: allowed product categories, limits on similar vendors, required permits.
3. Write the cancellation and withdrawal policy.
4. Choose the slot selection mode: open selection, category selection, or organizer assignment.
5. Build the floor plan: slots (with sizes, numbers, and categories in modes 2 and 3), walkways, and other areas. Set prices and the slots-per-vendor limit.
6. Add payment instructions (account details or QR code) and the payment deadline (24 hours by default).
7. Publish the floor plan, then **open the event to vendors**. Vendors can now find it and apply. Attendees can't see it yet.

**Edge cases**
- **Organizer on a phone opens the floor plan:** it's view-only, with a note "Edit the floor plan on a computer". Everything else works on mobile. Spec §3.4.
- **Required setup is missing (no payment instructions, no slots, no policy):** "Open to vendors" lists what's missing. **(screen)**
- **Organizer wants to change the mode after vendors hold slots:** blocked until every hold is released or removed. A warning lists the affected vendors. Spec §5.
- **Organizer changes the price or GCash number after vendors hold slots:** only new holds use the new values. Vendors who already hold slots keep what they were shown. Spec §6.1.
- **Organizer tries to delete or resize a held or reserved slot:** blocked with "Remove the vendor from this slot first". Spec §3.4.

## 4. Find an event and apply

*Vendor, mobile-first.*

1. Browse upcoming events (open to vendors or already announced). Filter by date and location.
2. Open an event: date, location, requirements, prices, floor plan, policy, and the organizer's verified badge.
3. Tap **Apply**. Upload the required permits. Applying means the vendor accepts the event policy.
4. Status shows **Submitted**. The vendor waits for the organizer.

**Edge cases**
- **Vendor isn't verified yet:** "Apply" is replaced with "Get verified to apply". Spec §4.2.
- **Vendor's product category isn't allowed at this event:** the event page says which categories are accepted before they apply. **(screen)**
- **Applications are closed:** "Apply" is replaced with "Applications closed". The vendor can still message the organizer. **(screen)**
- **Vendor was declined before:** they can apply again. Spec §3.3.
- **Vendor was removed before:** they can apply again only if the organizer allowed it. Otherwise they see "You can't reapply to this event". Spec §3.3.

## 5. Review applications

*Organizer.*

1. An email arrives: "New application".
2. Open the application: the vendor's profile, categories, and permits. A counter shows category fill, for example "Food: 4 of 5 accepted".
3. **Approve** or **Decline**, with an optional note. The vendor gets an email.

**Edge cases**
- **The category limit is already reached:** the counter shows it, but the organizer can still approve. The system doesn't auto-reject. Spec §3.2.
- **All slots are taken:** the organizer can still approve, in case a slot opens later. Spec §3.3.
- **Organizer closes applications with some still waiting:** the waiting ones can still be reviewed. **(screen)**

## 6. Get a slot

*The vendor must be verified and approved first.*

**Modes 1 and 2 (vendor picks)**
1. The vendor opens the floor plan. Open slots show size and price. In mode 2, only slots matching the vendor's categories can be picked.
2. Tap a slot → **Hold**. The slot is now "on hold" for this vendor only.
3. The payment screen opens right away (flow 7).

**Mode 3 (organizer assigns)**
1. The organizer sees the approved vendors without a slot and assigns each one.
2. The vendor gets an email with the slot, amount, payment instructions, and deadline (flow 7).

**Edge cases**
- **Two vendors tap the same slot at the same moment:** the first one gets it. The second sees "This slot was just taken. Pick another." Spec §5.
- **Approved, but no slots are open (or none in the vendor's category):** the vendor sees "No slots open right now. Message the organizer or check back later." There's no waitlist. Spec §4.3.
- **Vendor wants a different slot:** they release the hold and pick again. There's no "move" button. Spec §5.
- **Vendor tries to hold more slots than the limit:** the extra slots can't be held, and a note says "Up to N slots per vendor". Spec §5.
- **Event is already announced:** vendors can't pick slots anymore. Only the organizer can assign open slots. Spec §5.
- **Mode 3: the vendor misses the assignment email:** a reminder email goes out when 6 hours are left. Spec §8.1.

## 7. Pay and confirm payment

*Payment happens outside Creavent. The app only tracks proof.*

**Vendor**
1. The payment screen shows the amount due, the organizer's account details or QR code, the deadline countdown, and a notice that Creavent doesn't hold or guarantee payments.
2. The vendor pays through GCash, a bank, or another channel.
3. The vendor uploads a screenshot of the payment. **The countdown stops.** Status: **Submitted**.

**Organizer**
4. An email arrives: "Proof of payment uploaded".
5. The organizer compares the screenshot with the amount due.
6. **Approve** → the slot is **Reserved**, and the vendor's name appears on the floor plan and the vendor list.
   **Reject** with a reason → the vendor gets 12 hours to upload new proof.

**Edge cases**
- **The organizer is slow to review:** the hold can't expire while proof is waiting. Spec §6.4.
- **Blurry or wrong screenshot:** the organizer rejects it with "Screenshot is unreadable". The vendor re-uploads within 12 hours. Spec §6.3.
- **Vendor paid too little (₱400 of ₱500):** the organizer rejects it with "Short by ₱100". The vendor sends the rest and uploads a screenshot of the second payment. Spec §6.3.
- **Proof rejected close to the event:** the 12-hour window ends at the event start if that comes first. Spec §5.
- **Deadline passes with no proof:** the hold expires, the slot opens again, and both sides get an email. Spec §6.4.
- **Vendor needs more time:** they message the organizer, who can extend that vendor's deadline. Spec §6.3.
- **Vendor holds two slots and pays once for both:** *not decided yet.* See [open question A8](open-questions.md#a-payments). Until then, the vendor uploads the same screenshot for each slot.
- **The organizer's payment details looked suspicious:** the vendor can report the organizer with the report button. Spec §6.6.

## 8. Announce the event

*Organizer.*

1. The organizer checks the vendor list and the floor plan.
2. Tap **Announce**. The event appears in attendee discovery, and attendees who follow the organizer get an email.
3. From now on, an open slot can be filled only by assigning an approved vendor (flow 6, mode 3 steps).

**Edge cases**
- **Some slots are still on hold or unpaid when announcing:** a warning lists them, for example "3 slots not yet paid". The organizer can still announce. **(screen)**
- **A reserved vendor drops out after the announcement:** the organizer removes them (flow 9) and assigns the slot to another approved vendor, or leaves it empty. Spec §5.

## 9. Withdraw, remove, change, or cancel

**Vendor releases a held slot (not yet paid and approved)**
1. Tap **Release** → confirm. The slot opens again, and the organizer gets an email. Organizers can't turn this off.

**Vendor wants out after the slot is reserved**
1. The vendor messages the organizer.
2. The organizer decides under their own policy and removes the vendor if they agree. Refunds happen between the two of them.

**Organizer removes a vendor**
1. Tap **Remove** on the vendor → choose whether they can reapply → confirm.
2. The slot opens again, and the vendor gets an email. Payment records are kept read-only for both sides.

**Organizer changes date, time, or location**
1. Edit the event → save. Applied and confirmed vendors get an email, plus following attendees if the event is announced.

**Organizer cancels the event**
1. Tap **Cancel event** → confirm. Everyone involved gets an email. Refunds happen outside Creavent.

**Edge cases**
- **Vendor released by mistake:** the slot is open again. They can hold it again if no one else took it first. **(screen: the confirm step says this)**
- **Vendor and organizer disagree about a refund:** Creavent doesn't decide. Both sides can still download the payment records as evidence. Spec §6.6.
- **Vendor is removed and wants their screenshots:** they can still view and download them until 90 days after the event. Spec §6.7.

## 10. Discover and follow events

*Attendee. No account needed to browse.*

1. Open Creavent → see upcoming announced events, soonest first. Filter by location and date.
2. Open an event: schedule, location, description, organizer with verified badge, floor plan, and the vendor list.
3. Optional: sign in (magic link or Google) to **save** the event, or **follow** the event or the organizer.

**Edge cases**
- **Attendee wants to ask the organizer a question:** there's no contact option in the MVP. The page shows the public details only. Spec §7.
- **A held slot on the floor plan:** shows "On hold" with no vendor name. Names show only on reserved slots. Spec §5.
- **The event is changed or canceled after they followed it:** they get an email. Spec §8.1.
- **Attendee wants to report a fake event:** they sign in, then use the report button. Spec §7.
- **An event link is shared before announcement:** attendees can't see it yet. **(screen: "This event isn't public yet")**

## 11. Verify users, handle reports, suspend

*Admin.*

**Verification**
1. Open the verification queue → view the documents → approve, or reject with a reason.

**Reports**
1. Open a report → look at the user or event → dismiss it, hide the event, or suspend the account.

**Suspending an organizer with live events**
1. Suspend the account. Their upcoming events are hidden and frozen: no new applications, holds, or payments.
2. Vendors who applied or hold or reserved a slot get an email with the support address.
3. Later, the admin reinstates each event (if the organizer is reinstated) or cancels it.

**Edge cases**
- **An admin acts on a user's behalf (for example, to fix a stuck hold):** the action is logged with who, what, and when. Spec §2.
- **A rejected user disagrees:** they email support, and an admin re-reviews. There's no separate appeal. Spec §2.1.
