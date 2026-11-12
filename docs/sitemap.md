# Creavent MVP Sitemap

**Status:** First draft, agreed on 2026-11-12 and simplified the same day (spec §9). Lists every page in the MVP, who can open it, and how pages connect. The rules behind each page are in the [Feature specification](feature-specification.md), and the steps are in the [User flows](user-flows.md). If this file and the spec disagree, the spec wins.

Last updated: 2026-11-12

## 1. Principles

- **One event link for everyone.** `/events/[slug]` shows a different view depending on who opens it (section 3). Organizers share one link.
- **Separate vendor and organizer areas.** A user with both roles switches between `/vendor` and `/organizer` with a role switch in the header (spec §1).
- **Readable links.** Events and organizers use slugs, not ids, because links are shared in Facebook groups.
- **Mobile-first.** Every page works on a phone, for every role.
- **Admin is inside the same app**, under `/admin`, open only to admins.
- **No attendee accounts.** Accounts are for vendors and organizers (spec §1).

## 2. Page map

```
Public
├── /                              Event listing (announced events)
├── /events/[slug]                 Event page (view depends on viewer, section 3)
├── /organizers/[slug]             Organizer page
├── /approved                      What "Approved by Creavent" means
├── /login, /signup
├── /verify-email, /forgot-password, /reset-password
└── /terms, /privacy, /support

Account (any signed-in user)
├── /account                       Profile, email, password, contact number, roles
└── /account/legal                 Accept updated terms or privacy notice

Vendor (vendor role)
├── /vendor                        Dashboard
├── /vendor/events                 Browse events open to vendors or announced
├── /vendor/applications           Application list
├── /vendor/applications/[id]      Application detail, assigned slot, and payment
└── /vendor/profile                Vendor profile

Organizer (organizer role)
├── /organizer                     Dashboard
├── /organizer/events/new          Create a draft
├── /organizer/events/[id]         Event setup (tabs, section 4)
├── /organizer/events/[id]/applications
├── /organizer/events/[id]/vendors Vendors, slot assignment, and payments
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
- Upcoming **announced** events, soonest first, with filters for location (city) and date range (spec §7).
- Each card: cover, name, date, venue and city, organizer name with the "Approved by Creavent" badge.
- Links to event pages and organizer pages.

### `/events/[slug]` Event page

| Viewer | Event is `draft` | `open_to_vendors` | `announced` | `completed` or `canceled` |
|---|---|---|---|---|
| Signed-out visitor | Not found | "This event isn't public yet" | Public view | Public view, marked past or canceled |
| Vendor | Not found | Vendor view | Vendor view | Vendor view, marked past or canceled |
| The event's organizer | Link to setup | Public view plus "Manage event" | Same | Same |
| Admin | Everything, plus admin actions | | | |

- **Public view:** cover, schedule, venue and map link, description, organizer card with badge (links to the organizer page), public floor plan image, accepted-vendor list, report button (signed in), and the support email for reports from visitors.
- **Vendor view:** public view, plus requirements (categories, limits, permits), the slot list with sizes and prices, the vendor floor plan image, the event policy, the organizer's contact details for vendors, and **Apply**, or the vendor's current status with a link to the application. Attendees never see these parts.
- Hidden events are "Not found" to everyone except their organizer and admins (spec §2).

### `/organizers/[slug]` Organizer page
Everything a visitor needs to get to know the organizer (spec §7.1):
- Display name, logo, "Approved by Creavent" badge (links to `/approved`), about text, city, social media links, and when they joined Creavent.
- **Upcoming events** (announced only) and **past events** (completed), with their cover, date, and venue.
- Count of events held on Creavent.
- Report button (signed in).
- No contact form. Attendees cannot contact organizers in the MVP (spec §7).

### `/approved`
- A short explanation: Creavent reviewed the organizer's public pages and past events. It is not a guarantee. Payments happen outside Creavent (spec §2.1, §6.6).

### Sign-in pages
- `/signup`: Google, or email and password. Checkboxes to accept the terms and privacy notice and to confirm the minimum age (spec §1).
- `/login`, `/verify-email`, `/forgot-password`, `/reset-password`: see [User flows §1](user-flows.md#1-sign-up-and-add-a-role).

### `/terms`, `/privacy`, `/support`
- Terms and privacy notice show their current version and date.
- Support shows the support email address, for questions, reports, and account deletion requests (spec §1).

## 4. Organizer event setup tabs

`/organizer/events/[id]` is one page with tabs, so a draft can be filled in any order:

| Tab | Contents | Spec |
|---|---|---|
| Details | Name, date and time, venue, description, cover, vendor contact details | §3.1 |
| Requirements | Allowed categories, limit per category, required documents | §3.2 |
| Policy | Cancellation and withdrawal policy | §3.7 |
| Payments | Payment methods (account details, QR), deadline hours | §6.1 |
| Slots | Slot list (number, size, price), default price | §3.4 |
| Floor plan | Upload the vendor floor plan and the public floor plan images | §3.4 |

Header actions, depending on status: **Open to vendors** (lists anything missing, and needs organizer approval), **Open or close applications**, **Announce** (warns about unpaid slots), **Cancel event**.

`/organizer/events/[id]/vendors` shows approved vendors without a slot (with **Assign**), every slot with its vendor and payment status (including **Overdue**), and the proof review and **Remove** actions.

## 5. Navigation

| Area | Header | Main menu |
|---|---|---|
| Public, signed out | Logo, Events, Log in, Sign up | |
| Signed in, no role | Logo, Events, account menu | Account menu: Account, Become a vendor, Become an organizer, Log out |
| Vendor | Logo, role switch, account menu | Dashboard, Browse events, Applications, Profile |
| Organizer | Logo, role switch, account menu | Dashboard, Events, Profile, Approval |
| Admin | Logo, "Admin" label, account menu | Overview, Approvals, Reports, Users, Events |

The footer on every page has Terms, Privacy, and Support.

## 6. Admin pages

- **Approvals:** the organizer approval queue, sorted by oldest first. The detail page shows the organizer's profile, contact details, and links, with approve and reject.
- **Reports:** open reports, with links to the reported user or event, and dismiss, hide event, or suspend.
- **Users:** search by name or email. The detail page shows roles, approval, and suspension, with suspend and reinstate.
- **Events:** search, with hide and show again. Opening an application document or proof of payment from here is logged (spec §2).

Categories, settings, and the audit log are managed in seed data, configuration, and the database, not from admin pages (spec §2).

## 7. Not in the MVP

Saved and followed events, messaging, a vendor slot picker, a floor plan editor, identity verification pages, admin "view as this user", admin category and settings pages, public vendor pages or a vendor directory, attendee messaging, an announcements section, a waitlist page, contract signing pages, checkout and payout pages, and analytics dashboards (spec §9).
