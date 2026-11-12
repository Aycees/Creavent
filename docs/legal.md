# Creavent Legal and Compliance Notes

**Status:** Working notes, not legal advice. Development continues while the team discusses these questions. Every item here needs a Philippine lawyer's confirmation **before real users' data is collected** (section 1).

Last updated: 2026-11-12

## 1. The rule until the review is done

- Build and test with seed data and test accounts only, on local and staging.
- **Do not collect real permits or payment screenshots** until the privacy notice and terms of use are reviewed. A pilot with friendly organizers counts as real data.
- **Identity verification is deferred.** The MVP collects no government IDs or selfies (spec §2.1, decided 2026-11-12). This keeps the legal review smaller. It is revisited after the review (L1, L2).
- Placeholders in the app (minimum age, retention periods, terms and privacy text) are configuration values or content, so the lawyer's answers need a deploy but no code changes ([Data model §5.11](data-model.md#511-configuration)).

## 2. Positions to confirm

What Creavent already does, written so the lawyer can confirm or correct it.

| # | Position | Where it is decided |
|---|---|---|
| P1 | Creavent never processes, holds, or refunds money. Vendors pay organizers directly. Disputes are between the two. | [Revenue model §1](revenue-model.md#1-mvp-decision), spec §6 |
| P2 | Organizers are approved by an admin from their public social media pages and past event posts. No identity documents are collected. The badge reads "Approved by Creavent" and means "we reviewed their public pages and past events", not a guarantee. | Spec §2.1 |
| P3 | A notice is shown with every set of payment instructions: Creavent does not hold or guarantee payments. | Spec §6.6 |
| P4 | Private files (permits, proofs, payment QR codes) are seen only by the people listed in spec §11.1, through links that expire in 5 minutes. | Spec §6.5, §11 |
| P5 | Photo metadata (including GPS location) is removed from every image. | Spec §11.5 |
| P6 | Every admin decision, and every admin view of a permit or proof of payment, is logged. Admins cannot act on behalf of users. | Spec §2 |
| P7 | Payment records and vendor permits are deleted 90 days after the event. | Spec §6.7 |
| P8 | Vendors upload permits when applying. They are seen only by the vendor, the event's organizer, and admins. Permits can include health certificates (for example, for food vendors). | Spec §3.2, §11.1 |
| P9 | Users delete their account by emailing support, and the team deletes it by hand. Deletion wipes personal data but keeps records others rely on. | Spec §1 |
| P10 | Deleted data stays in database backups for up to 30 days. | [Architecture §9.3](architecture.md#93-backups) |
| P11 | Users accept the terms and privacy notice at signup, and each accepted version is recorded. | Spec §1 |
| P12 | Users confirm they are at least 18 at signup. | Spec §1 |
| P13 | A vendor's profile content is public on their vendor page: avatar, shop name, categories, about text, products, up to 8 photos, social media links, city, and the events where they have a reserved slot at an announced event. Vendors are told this during onboarding and in the terms of use. A vendor's phone number, email, applications, application documents, and payments are never public. | Spec §1.1, §7.2 |

## 3. Questions for the team (before the lawyer)

Answered by the team on 2026-11-12. **All legal concerns and documents will be handled before the platform launches to the public.** Until then, development works around them (section 1), and the open answers below are filled in later.

| # | Question | Notes | Answer (2026-11-12) |
|---|---|---|---|
| T1 | **Who is the legal entity** running Creavent: a registered business (DTI or SEC), a sole proprietor, or not set up yet? | Decides who the "personal information controller" is in the privacy notice, and who signs the terms. | Not set up yet. Set up before launch. |
| T2 | **Who is the Data Protection Officer?** | Required for any organization that handles personal data. Can be a team member. | Not decided. Appoint before launch. |
| T3 | **Minimum age for attendees:** settled for the MVP, since attendees have no accounts. Revisit when attendee accounts are added. | Vendors and organizers are 18+, because they handle permits and money. | Settled. |
| T4 | **When is launch** (or the first pilot with real users)? | The lawyer review has to finish before then. | No date yet. The pilot waits for the entity, the DPO, and the legal review. |
| T5 | **Budget for legal help:** one consultation plus a review of the drafts, or ongoing? | The minimum is in section 5. | Not decided. Settled before launch. |

**Before public launch (blocking):** T1, T2, T4, T5, the lawyer questions in section 4 (L2, L14, and L15 can wait for their post-MVP features), and the documents in section 6.

## 4. Questions for the lawyer

| # | Question | Why it matters |
|---|---|---|
| L1 | **Data Privacy Act (RA 10173):** are permits that show health information (health certificates, sanitary permits) or ID numbers "sensitive personal information"? What consent and security does that require? | Food vendors upload them when applying. Penalties include prison terms. |
| L2 | **Identity verification (post-MVP):** if government IDs and a selfie are collected later, what consent and storage rules apply? Is a selfie matched to an ID face "biometric data"? | Deferred from the MVP. Ask before it is built. |
| L3 | **NPC registration:** does Creavent need to register its data processing systems with the National Privacy Commission at launch, or only above a threshold? | The thresholds depend on how many people's sensitive data is processed. |
| L4 | **Retention:** is 90 days after the event right for payment records and permits? (G2) | Replaces the placeholder P7. |
| L5 | **Breach plan:** what must be reported to the NPC and to users, and how fast? | Needed before launch. |
| L6 | **Internet Transactions Act (RA 11967):** does Creavent count as an e-marketplace or digital platform, even though it never handles money? What duties follow (seller verification, complaint handling, takedowns)? | Could add obligations to the MVP. |
| L7 | **Liability for the "Approved by Creavent" badge:** if an approved organizer scams vendors, could Creavent be held responsible? How should the badge explanation and the payment notice be worded? | Vendors are told to check the badge before paying. Broad disclaimers can be struck down. |
| L8 | **Terms of use:** what must they contain to be enforceable under Philippine law (roles, suspension, no part in payments, fees later with notice, retention, and that a vendor's profile content is public)? (G4) | Templates from other countries often do not fit. |
| L9 | **Clickwrap acceptance:** is a checkbox at signup, with a recorded version, enough under the E-Commerce Act (RA 8792)? | This is how P11 works. |
| L10 | **Minimum age:** is 18 required for vendors and organizers? | Confirms P12. |
| L11 | **Privacy notice:** what must it say (purposes, sharing with organizers and admins, public vendor and organizer pages, retention, backups, rights, DPO contact)? (G3) | Drafted from section 2, finalized by the lawyer. |
| L12 | **Users' data rights:** what must the app support (access, correction, export, deletion), and how fast must requests be answered? | Deletion exists. Export may need to be added. |
| L13 | **Service providers abroad:** data is stored with Render (Singapore) and Cloudflare R2, and email goes through Resend. Is anything needed for storing personal data outside the Philippines? | Cross-border transfer rules. |
| L14 | **E-signatures (post-MVP):** is a typed name plus a drawn signature valid? (G1) | Only before contract signing is built. |
| L15 | **Tax (post-MVP):** when do fees trigger VAT and BIR registration? (G5) | Only before fees start. |
| L16 | **Public vendor pages:** is a notice in onboarding plus a clause in the terms enough for vendor content to be public (photos that may show people, about text, social links, city)? Is the vendor's consent needed for each item? | Vendors are told in onboarding and in the terms (P13). Vendor pages are new on 2026-11-12. |

## 5. Minimum legal work before launch

1. Answer T1 to T5 within the team.
2. One consultation with a lawyer who knows data privacy, using section 4 as the agenda.
3. Lawyer review of the privacy notice and terms of use, drafted from sections 2 and 4.
4. Appoint the DPO and write a short breach plan.
5. Update the placeholders (minimum age, retention, terms and privacy versions) in the configuration values ([Data model §5.11](data-model.md#511-configuration)). There are no admin settings pages.
6. A check-in later, before fees, online payments, or contract signing are added.

## 6. Documents to draft

- **Privacy notice** (`/privacy`): drafted from section 2, finalized after L1 to L5, L11 to L13, and L16. It says which vendor and organizer profile content is public.
- **Terms of use** (`/terms`): drafted from section 2, finalized after L6 to L10 and L16. It says that a vendor's profile content is public.
- **Onboarding text:** the short "these are public" notices on the vendor onboarding steps (spec §1.1), worded with the lawyer.
- **Breach plan:** internal, after L5.
