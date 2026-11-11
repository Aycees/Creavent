# Creavent Revenue Model

**Status:** Draft. The MVP approach is decided. The long-term revenue model is not, and will be finalized after the MVP shows how organizers and vendors actually use the platform.

Last updated: 2026-11-09

## 1. MVP decision

For the MVP, Creavent does **not** earn revenue. The goal is to gain users and learn how organizers and vendors behave.

- **Payments happen outside the platform.** Vendors pay the organizer directly through any channel the organizer sets up (GCash, bank transfer, QR code, or another account). Creavent does not process or hold money.
- **Vendors upload proof of payment.** After paying, a vendor uploads an image (for example, a GCash screenshot) to the application or reservation.
- **Organizers approve manually.** The organizer reviews the proof and approves or rejects the payment. Only then is the slot confirmed.
- **No platform fee.** There is no commission, service fee, or subscription in the MVP.
- **No payment gateway integration** (for example, PayMongo) in the MVP.

### Why

- **Matches current behavior.** Organizers in Davao already collect slot fees from vendors before the event, and GCash or bank transfer screenshots are the norm. No behavior change is needed to start.
- **Faster and cheaper to build.** No gateway onboarding, no split-payment setup, no refund or payout logic.
- **Avoids handling other people's money.** Holding funds raises compliance questions that are not worth taking on before the product has users.
- **Revenue per event is small at this scale.** See [section 4](#4-reference-fees-and-simulation). Charging early would earn little and could slow adoption.
- **Learning is the real goal.** The MVP tests whether the platform is useful enough that organizers and vendors would later pay for it.

### Trade-offs accepted

- No revenue from payments during the MVP.
- Organizers can verify payments incorrectly or be slow to approve. Mistakes and disputes stay between the two parties.
- Nothing stops organizers and vendors from working around the platform, because payment is not routed through it. Creavent's value in the MVP has to come from discovery, applications, floor plans, and organization, not from the payment itself.

### Launch pricing display

Show a "service fee: ₱0 (launch offer)" wherever a fee will eventually appear, so users are not surprised when fees start.

## 2. What the MVP should teach us

Questions the MVP should answer before the revenue model is finalized. These feed `docs/success-metrics.md`.

| Question | How to measure |
|---|---|
| Do organizers run real events through the platform? | Active organizers; events published; events with applications |
| Do organizers come back? | Organizers running a second or third event |
| Do vendors find and apply to events here? | Vendor signups; applications per event; slots filled per event |
| Is manual payment approval painful? | Time to approve; rejected or disputed proofs; organizer feedback |
| What are people willing to pay for? | Interviews with organizers and vendors; what they request |
| Is there real attendee traffic? | Event page views; follows and saves (this unlocks sponsor revenue later) |
| What are the real slot prices? | Slot price per event, so fee models can be tested with real numbers |

**Suggested trigger for revisiting monetization** (a guess, adjust it): about 8–10 active organizers and 25 or more events with applications through the platform, with some repeat organizers.

Note: analytics dashboards are out of scope for the MVP (see [Feature specification](feature-specification.md#9-out-of-scope-for-the-mvp)). How these questions get measured is still undecided. See [Open questions](open-questions.md).

## 3. Revenue strategies (catalog)

Every option discussed so far. None is decided. "Needs payments" means the strategy depends on routing money through the platform (online payments, not manual).

### A. Transaction-based

| Strategy | Payer | Needs payments | Notes |
|---|---|---|---|
| Service fee on slot reservations (vendor-paid) | Vendor | Yes | Shown at checkout, like Eventbrite or Airbnb guest fees. Vendors get a visible benefit (secured spot, protected deposit). |
| Commission on slot reservations (organizer-paid) | Organizer | Yes | Deducted from payout. Organizers may resist commissions more than vendors resist small service fees. |
| Two-sided fee (both pay) | Both | Yes | Splits the perceived cost. Total revenue is the same, only who feels it changes. Needs two fee fields and clear refund rules. |
| Fixed fee per transaction vs percentage | Either | Yes | A flat fee works better at low slot prices. A percentage works better at higher ones. |

### B. Subscriptions and access

| Strategy | Payer | Needs payments | Notes |
|---|---|---|---|
| Per-event organizer fee | Organizer | No | A fee to publish and manage an event. Fits sporadic, seasonal events better than a monthly plan. Can be collected manually at first. |
| Organizer Pro subscription | Organizer | No | Recurring event series, analytics, custom branding, priority support. Risky for hobbyist organizers with irregular events. |
| Vendor Pro subscription or pass | Vendor | No | Richer profile, analytics, early alerts. Vendors may resist paying before they win a spot. |
| Pay-to-apply credits | Vendor | No | Small credit per application. Likely to meet resistance. |

### C. Premium tools and trust

| Strategy | Payer | Needs payments | Notes |
|---|---|---|---|
| Paid vendor verification | Vendor | No | One-time or yearly fee for ID and permit review. Manual work, so price it above its cost. Ties directly to the trust problem Creavent solves. |
| Boosted applications or profiles | Vendor | No | Priority placement in an organizer's review list. |
| Event alerts (early notice) | Vendor | No | Paid early notification for popular events. |
| Premium organizer tools | Organizer | No | Advanced floor plan features, contract templates with e-signing, printable maps and vendor lists. |
| Vetted vendor pool access | Organizer | No | Access to vendors with a proven track record, instead of recruiting through Facebook groups. |

### D. Advertising, sponsors, and partners

| Strategy | Payer | Needs payments | Notes |
|---|---|---|---|
| Featured or promoted events | Organizer | No | Placement on the discovery page. Needs enough attendee traffic to be worth buying. |
| Event sponsors | Local brands, banks, e-wallets, malls | No | Sponsor placement on event pages or sponsor booths on the floor plan. Needs an audience first. |
| Platform-wide advertising | Brands | No | Banner or listing ads. Needs attendee traffic and risks hurting the experience. |
| Venue partnerships | Venues | No | Venues (malls, parks, function halls) pay to list, or Creavent earns a referral fee when an organizer books one. |
| Supplier affiliates | Suppliers | No | Referral cut from tents, tables, signage, printing, sound rental. |

### E. Services

| Strategy | Payer | Needs payments | Notes |
|---|---|---|---|
| Concierge services | Organizer | No | Help with Davao City permits, paperwork, or event promotion for a fee. Labor-intensive. |
| Event insurance or coverage | Organizer | No | Needs a partner. Local options unknown. |

### F. Data and partnerships

| Strategy | Payer | Needs payments | Notes |
|---|---|---|---|
| Aggregated insights for city or tourism offices | LGU, tourism office | No | Anonymized event and attendance data. More likely a partnership or grant than significant revenue. |

### G. Contrarian options

| Strategy | Notes |
|---|---|
| Free for everyone, funded by sponsors | Media-style model. Only works with real attendee traffic. |
| Charge for access instead of transactions | Avoids payment integration, but vendors may resist paying before winning a spot. |

## 4. Reference: fees and simulation

These figures are rough and **unverified**. Check PayMongo's live pricing before relying on them.

### PayMongo processing costs (published rates)

| Method | Rate | Cost on a ₱500 slot (rate plus 12% VAT on the fee) |
|---|---|---|
| QR Ph | about 1.34% | about ₱7.50 |
| GCash | about 2.23% | about ₱12.50 |
| Maya | about 1.96% | about ₱11 |
| Cards (domestic) | about 3.125% plus ₱13.39 | about ₱32.50 |

- PayMongo's published pages disagree. The [pricing docs](https://developers.paymongo.com/docs/pricing) and the [fees and rates page](https://developers.paymongo.com/docs/fees-and-rates) list different figures.
- Payouts to banks and e-wallets were reported at about ₱10 per transaction. Instant settlement costs extra.
- Split payments are part of the [Platforms product](https://developers.paymongo.com/docs/paymongo-platforms). No public pricing was found, and the pricing page ties it to a custom tier. Confirm with PayMongo whether it is self-serve.

### Simulation: one event, online payments

Assumptions: 15 vendors, ₱500 slot, payment mix of 50% GCash, 25% QR Ph, 10% Maya and 15% card, average processing cost about ₱14 per payment.

| Scenario | Vendor pays | Organizer receives | Creavent keeps after processing | Per event (15 vendors) |
|---|---|---|---|---|
| A. Vendor pays ₱25 | ₱525 | ₱500 | about ₱10.30 | about ₱155 |
| B. Organizer pays ₱25 | ₱500 | ₱475 | about ₱10.90 | about ₱164 |
| C. Split ₱15 vendor / ₱10 organizer | ₱515 | ₱490 | about ₱10.55 | about ₱158 |
| D. Split ₱20 vendor / ₱20 organizer (₱40 total) | ₱520 | ₱480 | about ₱25.40 | about ₱380 |

Takeaways:

- Processing costs eat more than half of a ₱25 fee. Who pays does not change Creavent's earnings, only the perception.
- At ₱500 slots, a total fee of about ₱40 (about 8%) is needed to keep around ₱25 net per slot, roughly ₱380 per event or about ₱7,600 per month at 20 events.
- Batch payouts per event, not per transaction, if payout fees apply.
- Slot price changes everything. Get real prices from Davao organizers.

## 5. Leading candidates (for the final decision)

A starting view, not a decision.

1. **Per-event organizer fee or Pro tier.** No payment dependency, and it fits sporadic events.
2. **Paid vendor verification and boosted profiles.** Tied to the trust problem Creavent solves.
3. **Vendor-heavy service fee with online payments** (PayMongo), with a smaller organizer share and a "founding organizer" perk (for example, no organizer commission for the first 6 months).
4. **Local sponsors and featured events**, once attendee traffic is real.
5. **Venue and supplier referrals** as a cheap add-on.

## 6. Open questions

- What are typical slot prices in Davao? Do they differ a lot between events?
- Will organizers and vendors pay for verification, boosting, or Pro tools? Which would they pick first?
- Will PayMongo offer split payments without a custom enterprise contract, and at what price?
- Does PayMongo refund its processing fee on refunds? What are the payout fees?
- Legal and tax: does holding funds before payout require any licence or registration in the Philippines? Is Creavent's fee subject to 12% VAT, and when? Confirm with a local accountant and lawyer.
- Which organizer pain points are strong enough that they would pay to remove them?
- How much does it cost to run the platform per month, and what is the break-even number of slots or events?

## 7. Design implications for the MVP

- A payment is recorded as "amount, status, payer, payee", always for the full slot price in the MVP (deposits come later), plus the proof-of-payment image, and the organizer's decision. Do not assume any fee.
- Payment statuses for the manual flow: pending (no proof yet), submitted (proof uploaded), approved, rejected.
- Keep fee-related fields (platform fee, who pays, processing cost) designed but unused, so online payments can be added later without reworking the data model.
- Proof-of-payment images need file storage and sensible access rules (visible only to the vendor, the organizer, and admins).

## 8. Decision log

| Date | Decision |
|---|---|
| 2026-11-07 | MVP focuses on gaining users. Payments are manual: vendors upload proof of payment, organizers approve. No platform fee and no payment gateway in the MVP. The final revenue model is deferred until after the MVP. |
| 2026-11-09 | To keep the MVP simple, contract signing, the deposit option, the waitlist, and event announcements move to "Features to be implemented" in [Project details](project-details.md#features-to-be-implemented). Payments are full price only. |
