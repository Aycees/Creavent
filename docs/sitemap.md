# Creavent MVP Sitemap

**Status:** First draft, agreed on 2026-11-12. Lists every page in the MVP, who can open it, and how pages connect. The rules behind each page are in the [Feature specification](feature-specification.md), and the steps are in the [User flows](user-flows.md). If this file and the spec disagree, the spec wins.

Last updated: 2026-11-12

## 1. Principles

- **One event link for everyone.** `/events/[slug]` shows a different view depending on who opens it (section 3). Organizers share one link.
- **Separate vendor and organizer areas.** A user with both roles switches between `/vendor` and `/organizer` with a role switch in the header (spec §1).
- **Readable links.** Events and organizers use slugs, not ids, because links are shared in Facebook groups.
- **Mobile-first.** Every page works on a phone, except the floor plan editor, which is desktop-only (spec §3.4).
- **Admin is inside the same app**, under `/admin`, open only to admins.
- Saving and following events are account features. They are not shown inside the vendor or organizer areas in the MVP.

## 2. Page map

```
Public
├── /                              Event listing (announced events)
├── /events/[slug]                 Event page (view depends on viewer, section 3)
├── /organizers/[slug]             Organizer page
├── /login, /signup
├── /verify-email, /forgot-password, /reset-password
├── /terms, /privacy, /support
└── /unsubscribe/[token]           From optional emails

Account (any signed-in user)
├── /account                       Profile, email, password, roles, close account
├── /account/legal                 Accept updated terms or privacy notice
└── /saved                         Saved events, followed events and organizers

Vendor (vendor role)
├── /vendor                        Dashboard
├── /vendor/events                 Browse events open to vendors or announced
├── /vendor/applications           Application list
├── /vendor/applications/[id]      Application detail
├── /vendor/events/[slug]/slots    Slot picker (modes 1 and 2)
├── /vendor/holds/[id]             Payment screen
├── /vendor/profile                Vendor profile
└── /vendor/verification           Get verified

Organizer (organizer role)
├── /organizer                     Dashboard
├── /organizer/events/new          Create a draft
├── /organizer/events/[id]         Event setup (tabs, section 4)
├── /organizer/events/[id]/applications
├── /organizer/events/[id]/vendors Vendors, slots, and payments
├── /organizer/profile             Organizer profile (feeds the organizer page)
└── /organizer/verification        Get verified

Both roles
└── /messages, /messages/[threadId]

Admin
├── /admin                         Overview (queue sizes, open reports)
├── /admin/verifications, /admin/verifications/[id]
├── /admin/reports, /admin/reports/[id]
├── /admin/users, /admin/users/[id]
├── /admin/events, /admin/events/[id]
├── /admin/categories
├── /admin/audit-log
└── /admin/settings
```

## 3. Public pages

### `/` Event listing
- Upcoming **announced** events, soonest first, with filters for location (city) and date range (spec §7).
- Each card: cover, name, date, venue and city, organizer name with verified badge.
- Links to event pages and organizer pages.

### `/events/[slug]` Event page

| Viewer | Event is `draft` | `open_to_vendors` | `announced` | `completed` or `canceled` |
|---|---|---|---|---|
| Attendee or signed-out visitor | Not found | "This event isn't public yet" | Public view | Public view, marked past or canceled |
| Vendor | Not found | Vendor view | Vendor view | Vendor view, marked past or canceled |
| The event's organizer | Link to setup | Public view plus "Manage event" | Same | Same |
| Admin | Everything, plus admin actions | | | |

- **Public view:** cover, schedule, venue and map link, description, organizer card (links to the organizer page), published floor plan (names on reserved slots only), accepted-vendor list, save and follow buttons (signed in), report button (signed in).
- **Vendor view:** public view, plus requirements (categories, limits, permits), slot prices, the event policy, the organizer's contact details for vendors, verification notice, and **Apply**, or the vendor's current status with a link to the application. Link to the slot picker when the vendor can pick (modes 1 and 2, before announcing).
- Hidden or frozen events are "Not found" to everyone except their organizer and admins (spec §2.1).

### `/organizers/[slug]` Organizer page
Everything a visitor needs to get to know the organizer (spec §7.1):
- Display name, logo, verified badge, about text, city, social media links, and when they joined Creavent.
- **Upcoming events** (announced only) and **past events** (completed), with their cover, date, and venue.
- Count of events held on Creavent.
- Follow button and report button (signed in).
- No contact form. Attendees cannot contact organizers in the MVP (spec §7).

### Sign-in pages
- `/signup`: Google, or email and password. Checkboxes to accept the terms and privacy notice and to confirm the minimum age (spec §1).
- `/login`, `/verify-email`, `/forgot-password`, `/reset-password`: see [User flows §1](user-flows.md#1-sign-up-and-add-a-role).

### `/terms`, `/privacy`, `/support`
- Terms and privacy notice show their current version and date.
- Support shows the support email address (spec §1).

## 4. Organizer event setup tabs

`/organizer/events/[id]` is one page with tabs, so a draft can be filled in any order:

| Tab | Contents | Spec |
|---|---|---|
| Details | Name, date and time, venue, description, cover, vendor contact details | §3.1 |
| Requirements | Allowed categories, limit per category, required documents | §3.2 |
| Policy | Cancellation and withdrawal policy | §3.7 |
| Payments | Payment methods (account details, QR), deadline hours | §6.1 |
| Slots | Slot selection mode, default price | §5, §3.4 |
| Floor plan | Editor on desktop. View-only on mobile with "Edit the floor plan on a computer" | §3.4 |

Header actions, depending on status: **Open to vendors** (lists anything missing), **Open or close applications**, **Announce** (warns about unpaid holds), **Cancel event**.

## 5. Navigation

| Area | Header | Main menu |
|---|---|---|
| Public, signed out | Logo, Events, Log in, Sign up | |
| Signed in, no role | Logo, Events, Saved, account menu | Account menu: Account, Become a vendor, Become an organizer, Log out |
| Vendor | Logo, role switch, Messages (unread dot), account menu | Dashboard, Browse events, Applications, Profile, Verification |
| Organizer | Logo, role switch, Messages (unread dot), account menu | Dashboard, Events, Profile, Verification |
| Admin | Logo, "Admin" label, account menu | Overview, Verifications, Reports, Users, Events, Categories, Audit log, Settings |

The footer on every page has Terms, Privacy, and Support.

## 6. Admin pages

- **Verifications:** the queue, sorted by oldest first. The detail page shows the documents (each view is logged, spec §2) with approve and reject.
- **Reports:** open reports, with links to the reported user or event, and dismiss, hide event, or suspend.
- **Users:** search by name or email. The detail page shows roles, verification, suspension, and a **read-only "view as this user"** link. Admins change records from admin pages, not by acting inside the user's own screens (spec §2).
- **Events:** search, with hide, freeze, reinstate, and cancel.
- **Categories:** add, rename, reorder, and turn categories off (spec §2).
- **Audit log:** filter by admin, action, and date.
- **Settings:** the values in `app_settings` ([Data model §5.12](data-model.md#512-audit-log-and-settings)).

## 7. Not in the MVP

Public vendor pages or a vendor directory, attendee messaging, an announcements section, a waitlist page, contract signing pages, checkout and payout pages, and analytics dashboards (spec §9).
