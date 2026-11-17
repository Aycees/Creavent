# Creavent Design Brief

**Status:** First draft. Describes the design system used by the "Creavent UI Mockup (MVP)", so the app can be built to match it. Behavior and rules live in the [Feature specification](feature-specification.md). Pages are in the [Sitemap](sitemap.md).

Last updated: 2026-11-14

## 1. Sources and precedence

- **The mockup** (claude.ai artifact "Creavent UI Mockup (MVP)") shows every MVP screen at desktop (1440 px) and phone (390 px) width.
- **The mockup stylesheet** (`creavent.css` in the mockup) holds the tokens and component classes listed below. It is the closest thing to working code. Start the app's styles from it.
- **The "Creavent v2" design system** (claude.ai artifact) is the base the mockup was built on. It was written for a broader product (tickets, a visitor role, booths, a "verified" mark), so the mockup departs from it in places (section 14).

When they disagree: the spec decides behavior and wording rules, the mockup decides how things look, and the design system fills any gap neither covers.

## 2. Audience and tone

| Who | Account | What they need from the screen |
|---|---|---|
| Attendee (visitor) | None | Dates, places, photos, who is selling. Big tap targets on phones. |
| Vendor | Yes | Requirements, fees, deadlines, the status of each application and payment. |
| Organizer | Yes | Checklists, slot counts, payment proofs to check, quick actions. Works on a phone too. |
| Admin | Internal | Queues, the facts needed to decide, and a clear record of what was done. |

**Personality:** calm, clear, and quietly confident. The interface stays neutral so each event's photos carry the mood. Creavent's job is to get out of the way.

**Launch context:** Davao City, English interface with simple wording, PHP (₱), Asia/Manila time. Light theme only.

## 3. Three rules

1. **Photos bring the color.** Screens are built from `canvas`, `surface`, and `ink`. Never tint a whole page or section with the brand color.
2. **Ember means "now" and "go".** The brand color (ember) is used only for the date stamp's month, the "Today" marker, and at most one conversion button per page (for example, "Sign up", "Apply as vendor", "Open to vendors", "Create vendor account"). Every other primary action is `ink`.
3. **One signature: the date stamp.** A small calendar block (ember month over a large ink day) appears on event cards, rows, and detail pages. There is no other decorative motif.

## 4. Voice and content

Plain, specific, and friendly. Say what happens and what to do next.

- **Sentence case everywhere**, including buttons, tabs, badges, and table headers: "Apply as vendor", never "APPLY AS VENDOR".
- **Use "you"** for the reader. Use "we" only for Creavent itself ("We'll email you").
- **No emoji** in interface copy. **No em-dashes**: use commas, periods, colons, or parentheses (project rule).
- **Say "Approved by Creavent"**, never "verified", for organizers (spec §2.1).
- **Money:** peso sign, comma thousands, tabular numerals: ₱350, ₱1,500. A range reads "₱800 to ₱1,500". Write "Free", never ₱0.
- **Dates and times:** 12-hour clock with no ":00" (5 PM, 9:30 AM). "to" for ranges, never a dash.

| Where | Single-day event | Multi-day event (spec §3.1.1) |
|---|---|---|
| Lists and cards | Sat, Nov 14 · 5 PM to 11 PM | Fri, Nov 20 to Sun, Nov 22 · 9 AM to 5 PM daily |
| Short rows | Sat · 5 PM | Fri to Sun, 3 days |
| Detail pages | Saturday, Nov 14 · 5 PM to 11 PM | Fri, Dec 18 to Sun, Dec 20 · 3 PM to 11 PM daily |
| Calendar day | Matina Night Flea · 5 PM | Pasalubong and Handmade Fair · 9 AM · day 2 of 3 |
| Deadlines | Pay by Fri, Nov 13 · 9 AM | (same) |

- Use "Today" and "Tomorrow" when true ("Payment due tomorrow, 9 AM").
- **Codes** (slot numbers, report numbers, reference numbers) are set in `mono`: A-03, B-04, RPT-0142.
- The separator between facts on one line is a middle dot with spaces: "Flea market · Damosa Gateway".

**Examples from the mockup**

| Moment | Copy |
|---|---|
| Notice before paying | Pay Sari-Sari Collective directly using either option. Creavent doesn't hold or process payments. |
| Deadline | About 21 hours left. Late payments are flagged to the organizer, who may give the slot to someone else. |
| Vendor-only event | Vendor view. This event is open to vendors. Visitors can't see it until the organizer announces it. |
| Confirm on approve | Approving reserves B-04 and emails Lola's Ukay. |
| Release slot | Can't make it? You can release this slot until your payment is approved. The organizer is notified. |
| Report link | Something wrong with this event? Email us at [support email] and we'll look into it. |

## 5. Color

A typical screen is about 80% canvas and surface, 17% ink and grays, 1 to 2% ember, and status colors only where a state exists.

| Token | Hex | Use |
|---|---|---|
| `canvas` | #FAFAF9 | Page background |
| `surface` | #FFFFFF | Cards, panels, inputs, tables, sheets |
| `sunken` | #F3F3F1 | Wells, table headers, unselected segments, photo placeholders |
| `inverse` | #18181B | Toasts, selected filter chip, primary button fill |
| `ink` | #18181B | Primary text and icons (16.9:1 on canvas) |
| `muted` | #5C5C63 | Metadata, helper text, secondary icons (6.0:1 on sunken) |
| `subtle` | #74747B | Placeholders, captions, disabled labels (4.6:1 on surface). Not for body text |
| `on-inverse` | #FFFFFF | Text on `inverse` and ink buttons |
| `border` | #E3E3E0 | Card outlines, dividers, table rules. Never the only edge of a control |
| `border-strong` | #8A8A90 | Input, checkbox, and secondary button outlines (3.4:1 on surface) |
| `brand` (ember) | #C93C17 | Date stamp month, Today marker, one conversion button per page (white text 5.1:1) |
| `brand-hover` | #B5330F | Hover and pressed brand button |
| `brand-soft` / `brand-ink` | #FDEDE7 / #9A2C0C | "Today" pill |
| `success` / `-soft` / `-ink` | #1B7A4C / #E4F3EA / #14563A | Approved, reserved, paid, announced, done steps |
| `warning` / `-soft` / `-ink` | #A85C00 / #FCEFD9 / #8A4B00 | Due soon, overdue, pending review, needed |
| `danger` / `-soft` / `-ink` | #B42A31 / #FCE7E7 / #A3222A | Declined, suspended, hidden, destructive actions |
| `info` / `-soft` / `-ink` | #2457A6 / #E6EEFA / #1D4E96 | Assigned, proof submitted, open to vendors, the "Approved by Creavent" seal |
| `focus` | #2457A6 | 2 px focus ring, 2 px offset |
| `scrim` | rgba(24,24,27,.56) | Behind text on photos and behind sheets |

**Rules**
- Text on a `-soft` background always uses the matching `-ink` color.
- A state is never shown by color alone. Every badge has a word, and alerts have an icon.
- Inline links are `ink` and underlined. Blue is for info states and the approval seal only.
- Ember is used as text only inside the date stamp.

### 5.1 Status badges

Badges are `radius-xs`, soft background with ink text, and a leading dot for statuses. Tags and facts (event type, "3 days", "Applications close Thu, Dec 10") use the `nodot` form.

| Tone | Class | Used for |
|---|---|---|
| Neutral | `b-neutral` | Draft, Submitted, Waiting, Completed, Past, Full, event type tags |
| Info | `b-info` | Open to vendors, Slot assigned, Proof submitted, spots left, Resubmitted, "3 days" |
| Success | `b-ok` | Reserved, Announced, Active, Confirmed |
| Warning | `b-warn` | Overdue, Payment due, Pending review, Needed, open report counts, over target |
| Danger | `b-bad` | Declined, Suspended, Hidden |
| Ink | `b-ink` | "Admin" label, "6 new" counts |
| Today | `b-today` | "Today" |

The same status always uses the same tone on every screen.

## 6. Typography

One family, **Geist** (400 to 700), for everything, and **Geist Mono** for codes. Both are on Google Fonts:
`https://fonts.googleapis.com/css2?family=Geist:wght@400..700&family=Geist+Mono:wght@400..600&display=swap`

| Style | Size / line | Weight | Tracking | Use |
|---|---|---|---|---|
| `display` | 48/52 (32/38 on phones) | 700 | -0.03em | Event title on detail pages |
| `h1` | 32/40 (26/32 on phones) | 650 | -0.02em | Page titles |
| `h2` | 24/32 | 600 | -0.02em | Section headings |
| `h3` | 18/24 | 600 | -0.01em | Card, panel, and dialog titles |
| `body-lg` | 18/28 | 400 | | Event descriptions |
| `body` | 16/24 | 400 | | Default text. Inputs stay at 16 px so iOS doesn't zoom |
| `sm` | 14/20 | 400 | | Metadata, table cells |
| `label` | 14/20 | 500 | | Buttons, tabs, form labels, table headers |
| `cap` | 12/16 | 500 | | Captions, timestamps, fine print |
| `eyebrow` | 13/20 | 500 | | "Step 2 of 4", dates above page titles |
| `price` | 20/24 | 600 | | Fees and amounts, tabular numerals |
| `stat` | 32/36 | 600 | -0.02em | Dashboard numbers, tabular numerals |
| `mono` | 13/20 | 500 | | Slot numbers and codes |

Use `font-variant-numeric: tabular-nums` (`tnum`) wherever numbers line up: prices, counts, phone numbers, times.

## 7. Spacing and layout

A 4 px base: 4, 8, 12, 16, 20, 24, 32, 48, 64.

- **Gutters:** 16 px on phones, 32 px on desktop.
- **Padding:** cards 16 px, panels 24 px.
- **Gaps:** cards 16 px on phones and 24 px on desktop. Sections 24 to 32 px on phones and 32 to 48 px on desktop.
- **Public pages:** a top header (64 px) and content up to 1264 px wide (`.wrap`), then a footer with Terms, Privacy, and Support.
- **Signed-in areas (vendor, organizer, admin):** a 240 px side menu, a 64 px top bar with the breadcrumb, role switch, and avatar, and content up to 1200 px wide. On phones the side menu becomes a scrolling row.
- **Breakpoint:** the mockup uses one, at 760 px. Below it: phone gutters, smaller `display` and `h1`, stacked layouts, and `.hide-m` elements are hidden.
- **Grids** use `repeat(auto-fit, minmax(min(<n>px, 100%), 1fr))` so cards and fields reflow without extra breakpoints.
- **Wide tables** scroll inside their own box (`.tbl-box`), never the page.

## 8. Shape and depth

| Radius | Value | Use |
|---|---|---|
| `xs` | 4 px | Badges, slot tiles |
| `sm` | 6 px | Tags, calendar events |
| `md` | 8 px | Buttons, inputs, alerts, wells, the date stamp |
| `lg` | 12 px | Cards, panels, table boxes, drop zones |
| `xl` | 16 px | Sheets, dialogs, detail page cover |
| `pill` | 999 px | Filter chips, role switch, search, avatars |

Depth comes from borders first. `shadow-sm` (0 1px 2px, 6%) for resting cards, `shadow-md` (0 4px 16px, 8%) for hover, menus, and the sticky summary card, `shadow-lg` (0 12px 32px, 14%) for sheets, dialogs, and toasts. Phone screens mostly use flat cards (`box-shadow: none`).

## 9. Brand

- **Logo: "Market grid"** (chosen 2026-11-12, [Project details](project-details.md#brand)). A 3 x 3 grid of small squares in `ink`, with the center square in ember and the last square outlined, next to the lowercase wordmark **creavent** in Geist 600, -0.035em. In the mockup it is pure CSS (`.wm` and `.wm-g`), so it scales with the font size: 22 px in headers, 20 px on phones.
- The logo links to the event listing (`/`).

## 10. Components

The class names are those in `creavent.css`. Build the app's components to match them.

**Actions**
- **Button** (`.btn`, 44 px tall, `radius-md`, `label`): `btn-primary` (ink), `btn-brand` (ember, one per page), `btn-secondary` (surface with `border-strong`), `btn-ghost`, `btn-danger`, `btn-danger-ghost`. `btn-sm` is 36 px for dense rows and tables. `btn-block` is full width. `btn-icon` is a 44 px square and needs an `aria-label`. Disabled buttons use `sunken` with `subtle` text, and a nearby note says why (for example, the "Open to vendors" checklist).
- **Role switch** (`.rs`): a pill with **Vendor** and **Organizer** segments in the top bar, shown only to users with both roles. The same pill style is used for List and Calendar, and for the payment channel.

**Navigation**
- **Tabs** (`.tabs`, `.tab`): underline tabs with a 2 px ink indicator. A tab can carry a count (`.cnt`), a check, or a "Needed" badge (event setup).
- **Side menu** (`.side`, `.side-a`) with counts, and the **top bar** (`.topbar`).
- **Phone header** (`.ph-hdr`, 56 px) with back button and title, **sticky action bar** (`.sticky-bar`) for the main action, and the vendor **tab bar** (`.tabbar`: Dashboard, Browse, Applications, Profile).

**Data display**
- **Date stamp** (`.ds`): ember month, ink day, muted weekday. Sizes `ds-sm` (44 x 48, no weekday), default (56 x 60), `ds-lg` (76 x 84). For multi-day events the stamp shows the first day, and the third line reads the end ("to 20"), with a "3 days" `b-info` tag nearby.
- **Approved by Creavent** (`.appr`): a blue seal with a white check, and the words "Approved by Creavent" (or "Approved" in tight panels). In the smallest cards the seal stands alone with a `title` and hidden text for screen readers. It links to `/approved` where it is not inside another link.
- **Badge** (section 5.1) and **tag** (`.tag`, 28 px, for categories on profiles).
- **Card** (`.card`), **panel** (`.panel`), **well** (`.well`, sunken box for notes and previews), **divider** (`.hr`).
- **Table** (`.tbl` in `.tbl-box`): sunken header row, 12 x 16 cell padding, right-aligned numbers (`.r`). Long runs of similar rows collapse into one row ("A-04 to A-16, 13 more at ₱800").
- **Key-value list** (`.kv`): two columns, muted keys, one column on phones.
- **Slot tiles** (`.slot`): `s-open` (dashed outline), `s-asg` (sunken, solid outline), `s-res` (ink fill, white text), `s-due` (warning). They differ in lightness and border style, not hue alone.
- **Progress steps** (`.steps`, `.step.done`, `.step.now`): onboarding and the application timeline.
- **Calendar**: month grid (`.cal`, `.cal-d`, `.cal-ev`, `.today`, `.sel`, `.out`) on desktop, and the compact month (`.mini`) with dots on event days on phones.
- **Avatar** (`.avatar`, `av-lg`, `av-xl`): initials on sunken, or the uploaded photo.
- **Photo placeholder** (`.ph`, 16:9, or `.ph32` for 3:2): sunken block with a centered 32 px icon and a small label.

**Forms**
- **Field** (`.fld`): label above, input, help text below (`.help`). Optional fields say "(optional)" in muted text after the label. Required-only fields say "(required)".
- **Input** (`.inp`): 44 px, 16 px text, `border-strong`. A fixed prefix such as "+63" sits in a sunken box beside the input.
- **Choice card** (`.opt`, `.opt.on` with a 2 px ink border): role pick, signup choice, "Paid with" option. Contains a real radio or checkbox.
- **Check box** (`.check`) inside choice cards.
- **Filter chip** (`.chip`, `.chip.on` = inverse fill): event type filters, category picks, phone filters. Shows a count (`.n`) where it helps.
- **Drop zone** (`.drop`): dashed box with icon, "Drop ... here, or choose a file", and the allowed types and size.
- **Search** (`.search`): pill with a leading icon (admin).

**Feedback**
- **Alert** (`.alert`, `al-info`, `al-ok`, `al-warn`, `al-bad`): icon plus one or two sentences.
- **Toast** (`.toast`): inverse, `shadow-lg`, for confirmations after an action.
- **Bottom sheet** on phones for focused tasks (for example, proof review): white sheet with a 36 px grab handle over the `scrim`.
- **Empty states** say what is missing and what to do next, in one line, with an action when there is one.

## 11. Icons

- Line icons on a 24 px grid, 1.5 px stroke, round caps and joins, no fill (`.ic`). Sizes: 16 px inline with small text, 20 px in the interface, 24 px in navigation and phone headers, 32 px in photo placeholders.
- Colored `ink` or `muted`. Status icons take their strong status color (green check, amber warning). Never ember.
- The mockup draws its icons inline. For development, use **Phosphor Icons (regular weight)**, the library the design system names, which matches this style. Decorative icons get `aria-hidden="true"`.

## 12. Imagery

- **Event covers:** stored at 16:9 (spec §11.5). Cards show them at 16:9. The detail page shows them in a 3:2 frame with `object-fit: cover`, which trims the sides slightly, so organizers should keep the subject centered.
- **Vendor photos:** square tiles in a grid on the vendor page.
- **Logos and avatars:** square, shown in a circle.
- No filters, color overlays, or stock illustrations. Text on a photo sits on the `scrim` or on a `surface` chip.
- No photo yet: the `.ph` placeholder.

## 13. Accessibility, touch, and motion

- **Touch targets:** every control is at least 44 x 44 px, even with a 20 px icon.
- **Focus:** 2 px solid `focus` ring with 2 px offset on every control, including cards that are links. Never remove outlines without this.
- **Contrast:** body text 4.5:1 or more (the token pairs above pass). `subtle` is only for captions and placeholders.
- **Real controls:** `<button>`, `<a href>`, `<input>` with `<label>`, `<fieldset>` and `<legend>` for groups. Icon-only buttons have an `aria-label`. Hidden text for screen readers uses a 1 px clipped span.
- **Not color alone:** every state has a word or icon (badges, slot tiles, checklist steps).
- **Motion:** 120 ms for hover and press, 200 ms ease-out for menus, sheets, and toasts. No bounce or parallax. With `prefers-reduced-motion`, only opacity changes.
  - **Curves:** `ease-out` is `cubic-bezier(0.23, 1, 0.32, 1)` (the built-in is too weak), `ease-in-out` is `cubic-bezier(0.77, 0, 0.175, 1)`, and `--ease-drawer` is `cubic-bezier(0.32, 0.72, 0, 1)`, all in `tokens.css`. Never `ease-in`, never `transition: all`.
  - **Press:** buttons, chips, cards and day links scale to 0.97 (cards 0.985) on `:active`. Hover effects only apply on devices that hover.
  - **Entrances:** `animate-rise` (fade plus an 8 px rise, 300 ms) once per container, never a parent and its children. Set the delay with `[--cv-delay:60ms]`. Stagger only the first three cards, 40 ms apart. Content below the fold does not animate.
  - **Phone action bar:** the event page pins "Get directions" and "Copy link" to the bottom of the screen on phones. They are the same elements as in the summary card (`max-md:` classes), and the bar slides up with `animate-sheet`.

## 14. Mobile-first guidelines

The whole product is mobile-first, organizers included (spec §10). Each screen in the mockup has a phone version at 390 px.

- One column. The main action sits in the sticky action bar at the bottom.
- Tables become lists of cards (for example, the vendor's applications and the organizer's slot list).
- Filters become a single scrolling row of chips.
- Long setup pages become tabs that scroll sideways, and each tab saves on its own.
- Focused review tasks (proof of payment) open in a bottom sheet.
- Copy, call, and directions are one tap, with large buttons.
- Uploads accept the camera ("Take a photo or choose a screenshot").

## 15. Differences from the Creavent v2 design system

| Design system says | The mockup and MVP do | Why |
|---|---|---|
| Wordmark with a 6 px ember square, no other symbol | "Market grid" logo | Chosen 2026-11-12 (DD-G) |
| Role switch with Visitor, Vendor, Organizer | Vendor and Organizer only, shown to users with both roles | Attendees have no accounts (spec §1) |
| "Verified" mark for organizers and vendors | "Approved by Creavent" seal for organizers only | No "verified" wording (spec §2.1) |
| Booths, booth map, tickets, "Get tickets", Waitlisted badge | Slots, a slot list with uploaded floor plan images, no tickets, no waitlist | MVP scope (spec §3.4, §9) |
| Organizer tools designed for desktop | Organizer tools are mobile-first too | Spec §10 |
| Phone breakpoint at 600 px | One breakpoint at 760 px | What `creavent.css` uses |
| Phosphor icons | Inline line icons in the same style | Mockup only. Use Phosphor in the app (section 11) |
| Ember "Live" dot | Not used | No live events in the MVP |

## 16. Small fixes for the mockup

- The admin approval screen marks the organizer's email "Verified". Use "Confirmed", as on the admin users screen, so "verified" never appears.
- Done on 2026-11-14: the event setup tabs link to each other, desktop and phone.

## 17. Not covered yet

- **Reference sites:** none recorded. The mockup is the reference.
- **Dark theme:** not in the MVP.
- **Screens not drawn:** `/approved`, the terms, privacy, and support pages, and most email templates (only "Confirm your email" and "Reset your password" are drawn). Build them from these rules and the spec.
