# Creavent MVP Sitemap

**Status:** First draft, agreed on 2026-11-12 and simplified the same day (spec §9). Lists every page in the MVP, who can open it, and how pages connect. The rules behind each page are in the [Feature specification](feature-specification.md), and the steps are in the [User flows](user-flows.md). If this file and the spec disagree, the spec wins.

Last updated: 2026-11-14

## 1. Principles

- **One event link for everyone.** `/events/[slug]` shows a different view depending on who opens it (section 3). Organizers share one link.
- **Separate vendor and organizer areas.** A user with both roles switches between `/vendor` and `/organizer` with a role switch in the header (spec §1).
- **Readable links.** Events, organizers, and vendors use slugs, not ids, because links are shared in Facebook groups.
- **Mobile-first.** Every page works on a phone, for every role.
- **Admin is inside the same app**, under `/admin`, open only to admins.
- **No attendee accounts.** Accounts are for vendors and organizers (spec §1).

## 2. Page map

```
Public
├── /                              Event listing (announced events)
├── /events/[slug]                 Event page (view depends on viewer, section 3)
├── /organizers/[slug]             Organizer page
├── /vendors/[slug]                Vendor page (no directory or search)
├── /approved                      What "Approved by Creavent" means
├── /login, /signup
├── /verify-email, /forgot-password, /reset-password
└── /terms, /privacy, /support

Account (any signed-in user)
├── /onboarding                    Vendor and organizer onboarding (4 steps each)
├── /account                       Profile, email, password, contact number, roles
└── /account/legal                 Accept updated terms or privacy notice

Vendor (vendor role)
├── /vendor                        Dashboard
├── /vendor/events                 Browse events open to vendors or announced
├── /vendor/events/[slug]/apply    Apply: categories, documents, slots, policy
├── /vendor/applications           Application list
├── /vendor/applications/[id]      Application detail, assigned slot, and payment
├── /vendor/applications/[id]/slot Pick another or a first preferred slot
└── /vendor/profile                Vendor profile

Organizer (organizer role)
├── /organizer                     Dashboard
├── /organizer/events/new          Create a draft
├── /organizer/events/[id]         Event setup (tabs, section 4)
├── /organizer/events/[id]/applications
├── /organizer/events/[id]/vendors Vendors, slot assignment, and payments
├── /organizer/applications        Applications across every event, with filters
├── /organizer/applications/[id]   One application: shop, documents, slot, history, actions
├── /organizer/profile             Organizer profile (feeds the organizer page)
└── /organizer/approval            Get approved

Admin
├── /admin                         Overview (approval queue size, open reports)
├── /admin/approvals, /admin/approvals/[id]
├── /admin/reports, /admin/reports/[id]
├── /admin/users, /admin/users/[id]
└── /admin/events, /admin/events/[id]
```

## 3. Public pages

### `/` Event listing
- Upcoming **announced** events, soonest first, with a search box (event name, venue, address, city, organizer) and filters for event type (All, Flea markets, Bazaars, Pop-ups, each with a count), location (city), and date (Any date, This weekend, Next 2 weeks, next month, Pick dates) (spec §7.3).
- **List and Calendar views**, switched with a toggle.
  - List groups events as This weekend, Next weekend, and Later.
  - Calendar is a month grid with today marked, events shown in each day, and a panel that lists the selected day's events. On phones it is a compact month with dots on event days, and the selected day's events are listed below.
- **"Next 7 days" strip** beside the page title: the next 7 days with today marked, a mark on days that have announced events, and a link to the calendar.
- **"Sell at these events"** link to sign up, showing how many events are open to vendors. Signed-out visitors see the number only. For a signed-in vendor the link goes to `/vendor/events`.
- Each card: cover, name, event type tag, date (or date range and number of days for a multi-day event), venue and city, organizer name with the "Approved by Creavent" badge.
- Links to event pages and organizer pages.

### `/events/[slug]` Event page

| Viewer | Event is `draft` | `open_to_vendors` | `announced` | `completed` or `canceled` |
|---|---|---|---|---|
| Signed-out visitor | Not found | "This event isn't public yet" | Public view | Public view, marked past or canceled |
| Vendor | Not found | Vendor view | Vendor view | Vendor view, marked past or canceled |
| The event's organizer | Link to setup | Public view plus "Manage event" | Same | Same |
| Admin | Everything, plus admin actions | | | |

- **Public view:** cover, event type tag, schedule, venue with "Get directions", "Copy link", number of confirmed vendors, description, organizer card with badge, about, and social links (links to the organizer page), public floor plan image, accepted-vendor list with each vendor's category and slot number, filterable by category (each name links to that vendor's page, or shows without a link when that page is not available), "Details updated" date, report button (signed in), and the support email for reports from visitors.
- **Vendor view:** public view, plus a note when the event is not public yet, the applications close date, requirements (accepted categories with limit and spots left, and the documents to upload, some for one category only), the slots grouped by section with size, note, price, and open count (with "You can choose a preferred slot when you apply" when the organizer allows it), the vendor floor plan image, the event policy, a summary (fee range, applications close, pay within, paid to), the organizer's contact details for vendors, and **Apply**, or the vendor's current status with a link to the application. Attendees never see these parts.
- Hidden events are "Not found" to everyone except their organizer and admins (spec §2).

### `/organizers/[slug]` Organizer page
Everything a visitor needs to get to know the organizer (spec §7.1):
- Display name, logo, "Approved by Creavent" badge (links to `/approved`), about text, city, social media links, and when they joined Creavent.
- **Upcoming events** (announced only) and **past events** (completed), with their cover, event type tag, date, and venue.
- Count of events held on Creavent.
- Report button (signed in).
- No contact form. Attendees cannot contact organizers in the MVP (spec §7).

### `/vendors/[slug]` Vendor page
Everything an attendee needs to get to know a vendor (spec §7.2). There is no vendor directory or search, so the page is reached from the accepted-vendor list on an event page, or from a shared link.
- Avatar, shop name, product categories, about text, products, up to 8 vendor photos, social media links, city, when they joined Creavent, and the number of events they have sold at.
- **Find them next at:** the vendor's next upcoming event, with the slot number (event `announced`, slot `reserved`).
- **Where they've sold:** events where the vendor had a `reserved` slot and the event was announced (`announced` or `completed`). Never `draft`, `open_to_vendors`, or events canceled before being announced, or events canceled after being announced.
- Never shown: phone number, email, applications, application documents, payments, or events applied to without a reserved slot.
- Report button (signed in). No contact form and no messaging.
- Not found while the vendor role is suspended or the account is deleted.

### `/approved`
- A short explanation: Creavent reviewed the organizer's public pages and past events. It is not a guarantee. Payments happen outside Creavent (spec §2.1, §6.6).

### Sign-in pages
- `/signup`: first asks "I'm signing up to: Sell at events (vendor account) or Run events (organizer account)". This only pre-selects the role in onboarding. Then the form: full name, Google or email and password, and checkboxes to accept the terms and privacy notice and to confirm "I'm 18 or older" (spec §1).
- `/login`: sign in, plus **Create a vendor account** and **Create an organizer account** entry points to `/signup`.
- `/verify-email`, `/forgot-password`, `/reset-password`: see [User flows §1](user-flows.md#1-sign-up-and-onboarding).

### `/onboarding`
Opens after the email is confirmed (spec §1.1). Both flows share step 1, "How will you use Creavent?", then show "Step N of 4" with a **Finish later** option. Progress is saved.
- **Vendor:** Role, Shop, Photos (can be skipped), Contact. The done screen shows a profile preview with a link to the public vendor page, events open to vendors that accept their categories, and a "Finish your profile" checklist.
- **Organizer:** Role, Organizer page, Contact, Get approved. **Submit for review** leads to a "Pending review" screen with a timeline, a "Create your first event as a draft" step, a preview of the organizer page, and the support email. **Do this later** leaves approval at `not submitted`. The same step stays available at `/organizer/approval`.

### `/terms`, `/privacy`, `/support`
- Terms and privacy notice show their current version and date.
- Support shows the support email address, for questions, reports, and account deletion requests (spec §1).

## 4. Organizer event setup tabs

`/organizer/events/[id]` is one page with tabs, so a draft can be filled in any order:

| Tab | Contents | Spec |
|---|---|---|
| Details | Name, event type (Flea market by default), start and end date (1 to 7 days), daily opening and closing time, venue, description, cover, vendor contact details, applications close date, ingress details | §3.1 |
| Requirements | Allowed categories, limit per category, required documents (all vendors or one category) | §3.2 |
| Policy | Cancellation and withdrawal policy, prefilled from the organizer's last event (or an example on a first event) | §3.7 |
| Payments | Payment options vendors can pick from (channel, account details, QR), deadline hours | §6.1 |
| Slots | Vendor floor plan upload, shown as a reference next to the list (behind "Show floor plan" on phones), how slots are filled (I assign slots, or Vendors choose a preferred slot), slot list (section, number, size, note, price), default price, "Add a row of slots", slot preview | §3.4 |
| Public floor plan | Upload the public floor plan image (vendors placed) | §3.4 |

Header actions, depending on status: **Preview as vendor**, **Delete draft** (drafts only), **Open to vendors** (an "Open to vendors" checklist shows the five required steps: details with cover, requirements, policy, at least one slot, payment instructions. It needs organizer approval), **Open or close applications**, **Announce** (warns about unpaid slots), **Cancel event**.

`/organizer/events/[id]/vendors` has tabs for Applications, Vendors and slots, and Event setup, and header actions **Close applications** and **Announce event**. It starts with **slots at a glance** (how many slots are reserved, assigned, overdue, open, and set aside). It then shows approved vendors without a slot (with how many slots they asked for, their preferred slots, if any, and **Assign slot**, which selects the preferred slots that are still open, up to the number asked for), and every slot with its vendor, amount, payment status (Waiting, Proof submitted, Proof rejected with the reason, **Overdue**), and deadline, filtered by All, Needs attention, Reserved, or Open. The proof review panel shows the receipt, amount due, the option the vendor paid with, the amount and reference they entered, and **Approve payment** or **Reject**. Approving a payment without a proof image is the **Mark paid** action, which needs a note (spec §6.3). **Remove** frees the slot.

### Dashboards and lists
- `/organizer` shows to-do counts per event (applications to review, proofs to check, overdue payments, approved vendors with no slot), and Upcoming and Past event tabs with status, slot fill, and next step (spec §3.8).
- `/vendor` shows what needs action, the applications table, the next confirmed event with ingress details, and events open to vendors (spec §4.6).
- `/vendor/applications/[id]` shows the slot, amount due, payment methods with copy buttons, the proof upload (option paid with, amount sent, reference number), the deadline, a progress timeline, the organizer's contact, and **Release slot** (spec §4.6, §6.2).
- `/vendor/events` lists events open to vendors or announced, soonest first, with search and date and city filters. Each shows the vendor's remaining spots in their categories when the organizer set a limit, the fee range, the applications close date, a "Choose a preferred slot" tag when the event allows it, and the vendor's own status there (applied, slot assigned, declined) (spec §4.2).
- `/vendor/events/[slug]/apply` asks for the categories, the required documents, how many slots (when the event allows more than one), and, when the event lets vendors choose, preferred slots from the vendor floor plan and the slots grouped by section, each marked Open or Taken (or "No preference"). It ends with the policy and **Submit application** (spec §4.2, §4.3).

## 5. Navigation

| Area | Header | Main menu |
|---|---|---|
| Public, signed out | Logo, Events, Log in, Sign up | |
| Signed in, no role | Logo, Events, account menu | Account menu: Account, Become a vendor, Become an organizer, Log out |
| Account menu, any signed-in user | | Vendor dashboard and Organizer dashboard (for each role the user has), Admin (admins), Account, Become a vendor or Become an organizer (for each role the user doesn't have), Log out (added 2026-11-13) |
| Vendor | Logo, role switch, account menu | Dashboard, Browse events, Applications, Profile |
| Organizer | Logo, role switch, account menu | Dashboard, Events, Profile, Approval (shows the approval status) |
| Admin | Logo, "Admin" label, search (users, organizers, events), account menu | Overview, Approvals, Reports, Users, Events (Approvals and Reports show counts) |

The footer on every page has Terms, Privacy, and Support.

## 6. Admin pages

- **Overview:** counts of organizers waiting (and how many are over the 2-day target), open reports, and resubmissions, then the approval queue and open reports.
- **Approvals:** the organizer approval queue, sorted by oldest first, with links count and waiting time. The detail page ("1 of 7 in queue", **Next**) shows the links to check, the organizer's profile and contact details, the account (created date, other roles, draft events), and the decision: approve, or reject with a reason, plus an optional internal note.
- **Reports:** Open and Resolved tabs. Open reports are grouped by event or user, oldest first, with their source (report button or support email). The detail page shows the reference number, what each person said, an internal note, and dismiss, hide event, or suspend. Admins can add a report from a support email.
- **Users:** search by name, email, or shop, filtered by All, Vendors, Organizers, Suspended. The detail page shows contact details, roles, approval, activity, open reports, and history, with suspend or reinstate for each role (the reason is shown to the user).
- **Events:** every event, including drafts and hidden ones, filtered by status (Open to vendors, Announced, Reported, Hidden, Drafts). The detail page shows the organizer, vendors, reports, and applications, with hide (the reason is emailed to the organizer) and show again. Opening an application document or proof of payment from here is logged (spec §2).

Categories, settings, and the audit log are managed in seed data, configuration, and the database, not from admin pages (spec §2).

## 7. Not in the MVP

Saved and followed events, messaging, a vendor slot booking page (vendors only state a preferred slot on the apply form), a floor plan editor, identity verification pages, admin "view as this user", admin category, event type, and settings pages, a vendor directory or vendor search, attendee messaging, an announcements section, a waitlist page, contract signing pages, checkout and payout pages, and analytics dashboards (spec §9).
