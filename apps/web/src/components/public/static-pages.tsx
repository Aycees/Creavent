import { CheckIcon, EnvelopeSimpleIcon, StorefrontIcon, WarningIcon } from "@phosphor-icons/react/dist/ssr"
import Link from "next/link"

import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { CopyTextButton } from "./copy-text-button"

function Mail({ email }: { email: string }) {
  return (
    <a href={`mailto:${email}`} className="text-ink underline underline-offset-2">
      {email}
    </a>
  )
}

function Point({ id, title, icon, children }: { id: string; title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 md:p-6">
      <h2 id={id} className="flex items-center gap-2.5 text-h3">
        {icon}
        {title}
      </h2>
      <ul className="flex flex-col gap-2 pl-8 text-sm md:text-body">{children}</ul>
    </section>
  )
}

// /approved (spec §2.1, §6.6, mockup Approved): what the seal means, and
// what it doesn't. Never says "verified".
export function ApprovedView({ supportEmail }: { supportEmail: string }) {
  return (
    <div className="flex flex-col gap-10 md:flex-row md:items-start md:gap-20">
      <div className="flex flex-col gap-5 md:sticky md:top-6 md:flex-[1_1_380px]">
        <span aria-hidden="true" className="grid size-13 place-items-center rounded-pill bg-info md:size-16">
          <svg viewBox="0 0 12 12" className="size-6 fill-none stroke-on-inverse stroke-[1.6] [stroke-linecap:round] [stroke-linejoin:round] md:size-7.5">
            <path d="M3 6.2l2 2 4-4.4" />
          </svg>
        </span>
        <h1 className="text-[30px] leading-9 font-bold tracking-[-0.03em] text-balance md:text-display">What &quot;Approved by Creavent&quot; means</h1>
        <p className="text-muted md:text-body-lg">
          Every organizer is reviewed by the Creavent team before they can open an event to vendors. This seal shows they passed that review.
        </p>
      </div>
      <div className="flex min-w-0 flex-col gap-4 md:max-w-[720px] md:flex-[999_1_560px]">
        <Point id="a-check" title="What we check" icon={<CheckIcon aria-hidden="true" className="size-6 text-success" />}>
          <li>Their organizer page on Creavent: name, about, city, and contact details</li>
          <li>Their public pages, like Facebook or Instagram, and that they match</li>
          <li>Events they&apos;ve run before, where they have them</li>
        </Point>
        <Point id="a-not" title="What it doesn't mean" icon={<WarningIcon aria-hidden="true" className="size-6 text-warning" />}>
          <li>It isn&apos;t a guarantee. Organizers run their own events.</li>
          <li>Creavent doesn&apos;t hold or process payments. Vendors pay organizers directly, and refunds are between the two of them.</li>
        </Point>
        <Point id="a-pay" title="Before you pay for a slot" icon={<StorefrontIcon aria-hidden="true" className="size-6" />}>
          <li>Pay only with the options shown on your application page.</li>
          <li>Look at the organizer&apos;s page and their past events.</li>
          <li>Keep your receipt. Upload it as your proof of payment.</li>
        </Point>
        <div className="flex flex-col gap-1 rounded-md bg-sunken px-4 py-4 md:px-5">
          <p className="text-label">Something wrong with an organizer?</p>
          <p className="text-sm text-muted">
            Email us at <Mail email={supportEmail} />. We can suspend organizers who break the rules.
          </p>
        </div>
      </div>
    </div>
  )
}

type Section = { id: string; title: string; body: React.ReactNode }

function termsSections(minimumAge: number, supportEmail: string): Section[] {
  return [
    {
      id: "who",
      title: "Who can use Creavent",
      body: <p>{`You need to be ${minimumAge} or older to create a vendor or organizer account. Anyone can browse announced events without an account.`}</p>,
    },
    {
      id: "accounts",
      title: "Accounts and roles",
      body: <p>One account can hold a vendor role, an organizer role, or both. Keep your login details private. You&apos;re responsible for what happens under your account.</p>,
    },
    {
      id: "organizers",
      title: "Organizers and events",
      body: (
        <p>
          Organizers need approval from Creavent before opening an event to vendors. Organizers set their own requirements, slot prices, and cancellation and
          withdrawal policy, and they decide who gets a slot.
        </p>
      ),
    },
    {
      id: "vendors",
      title: "Vendors and slots",
      body: <p>Applying doesn&apos;t guarantee a slot. A slot is confirmed only after the organizer approves your payment. You can release an assigned slot until then.</p>,
    },
    {
      id: "payments",
      title: "Payments",
      body: (
        <ul>
          <li>Creavent doesn&apos;t hold, process, or guarantee payments.</li>
          <li>Vendors pay organizers directly, using the options the organizer lists.</li>
          <li>Refunds and disputes are handled between the organizer and the vendor.</li>
        </ul>
      ),
    },
    {
      id: "public",
      title: "Public pages",
      body: <p>Organizer and vendor profiles are public pages. Your phone number, email, documents, and payments are never shown on them.</p>,
    },
    {
      id: "reports",
      title: "Reports and suspension",
      body: <p>We may hide events or suspend accounts that break these terms. We tell you the reason.</p>,
    },
    {
      id: "records",
      title: "How long we keep records",
      body: <p>Payment records and application documents are deleted 90 days after the event date, or 90 days after a canceled event was canceled.</p>,
    },
    {
      id: "changes",
      title: "Changes and contact",
      body: (
        <p>
          When these terms change, we ask you to accept the new version the next time you log in. Questions go to <Mail email={supportEmail} />.
        </p>
      ),
    },
  ]
}

function privacySections(supportEmail: string): Section[] {
  return [
    {
      id: "collect",
      title: "What we collect",
      body: (
        <p>
          Your name, email, and mobile number; your organizer or shop profile and photos; and, for vendors, your applications, the documents you upload, and
          your proofs of payment.
        </p>
      ),
    },
    {
      id: "public",
      title: "What is public",
      body: (
        <p>
          Organizer and vendor pages, and the events where a vendor has a confirmed slot. Your phone number, email, applications, documents, and payments are
          never public.
        </p>
      ),
    },
    {
      id: "sharing",
      title: "Who else sees your details",
      body: (
        <p>
          The organizer of an event you apply to sees your contact number, documents, and payments for that event. Vendors see an event&apos;s organizer contact
          details. Creavent admins see what they need to approve organizers and handle reports.
        </p>
      ),
    },
    {
      id: "records",
      title: "How long we keep it",
      body: <p>Payment records and application documents are deleted 90 days after the event date, or 90 days after a canceled event was canceled.</p>,
    },
    {
      id: "rights",
      title: "Your rights and contact",
      body: (
        <p>
          You can ask to see, correct, or delete your data. Email <Mail email={supportEmail} />.
        </p>
      ),
    },
  ]
}

const versionDay = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric", year: "numeric" })

// /terms and /privacy (sitemap §3, mockup Terms). Placeholder text until the
// legal review (legal §1); the version is the configured one users accept.
export function LegalView({ kind, version, minimumAge, supportEmail }: { kind: "terms" | "privacy"; version: string; minimumAge: number; supportEmail: string }) {
  const sections = kind === "terms" ? termsSections(minimumAge, supportEmail) : privacySections(supportEmail)
  const title = kind === "terms" ? "Terms of use" : "Privacy notice"
  const dated = /^\d{4}-\d{2}-\d{2}$/.test(version) ? `Version of ${versionDay.format(new Date(`${version}T00:00:00Z`))}` : `Version ${version}`
  const tab = (href: string, label: string, current: boolean) => (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={cn("inline-flex h-9 items-center rounded-pill px-4 text-label no-underline", current ? "bg-surface text-ink shadow-sm" : "text-muted")}
    >
      {label}
    </Link>
  )

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <nav aria-label="Legal documents" className="inline-flex gap-0.5 self-start rounded-pill bg-sunken p-1">
          {tab("/terms", "Terms of use", kind === "terms")}
          {tab("/privacy", "Privacy notice", kind === "privacy")}
        </nav>
        <h1 className="text-h1">{title}</h1>
        <p className="-mt-2 text-sm text-muted">{dated}</p>
        <Alert tone="warning" className="max-w-[720px]">
          Placeholder text. The final version replaces it after the legal review, before Creavent opens to the public.
        </Alert>
      </div>
      <div className="flex flex-col gap-8 md:flex-row md:items-start md:gap-20">
        <nav aria-label="On this page" className="flex flex-col gap-0.5 md:sticky md:top-6 md:w-[260px] md:flex-none">
          <p className="pb-2 text-label text-muted md:px-3">On this page</p>
          {/* Phones: one scrolling row, so the text starts right away. */}
          <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:flex-col md:gap-0 md:px-0">
            {sections.map((s) => (
              <li key={s.id} className="flex-none">
                <a
                  href={`#${s.id}`}
                  className="flex min-h-11 items-center rounded-pill border border-border-strong bg-surface px-4 text-label whitespace-nowrap text-ink no-underline md:rounded-md md:border-0 md:bg-transparent md:px-3 md:text-muted md:hover:bg-sunken md:hover:text-ink"
                >
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <article className="flex max-w-[680px] flex-col gap-3.5 text-body leading-[26px] [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-1.5 [&_ul]:pl-5">
          {sections.map((s, i) => (
            <section key={s.id} aria-labelledby={s.id} className={cn("flex scroll-mt-6 flex-col gap-3", i > 0 && "mt-4")}>
              <h2 id={s.id} className="text-[20px] leading-7 font-semibold tracking-[-0.01em]">
                {s.title}
              </h2>
              {s.body}
            </section>
          ))}
        </article>
      </div>
    </div>
  )
}

// /support (sitemap §3, mockup Support): questions, reports, refunds, and
// account deletion all go to the support email (spec §1).
export function SupportView({ supportEmail }: { supportEmail: string }) {
  const topics = [
    {
      title: "Report an event or user",
      body: "Send the page link, what happened, and when. Add screenshots if you have them. Signed in? You can also use the report button on the page.",
    },
    {
      title: "Payments and refunds",
      body: "Creavent doesn't hold payments, so we can't send refunds. Contact the organizer using the details on your application page. Your payment records stay downloadable for 90 days after the event.",
    },
    { title: "Delete your account", body: "Email us from the address on your account and say you want it deleted." },
  ]
  return (
    <div className="flex flex-col gap-8 md:gap-10">
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:gap-20">
        <div className="flex flex-col gap-3.5 md:flex-[999_1_520px]">
          <h1 className="text-[32px] leading-[38px] font-bold tracking-[-0.03em] md:text-display">Support</h1>
          <p className="max-w-[560px] text-muted md:text-body-lg">
            Write to us for questions, reports about an event or user, or to delete your account. We reply by email.
          </p>
        </div>
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 md:max-w-[440px] md:flex-[1_1_360px] md:p-5 md:shadow-md">
          <p className="text-cap text-muted">Email</p>
          <p className="text-h3 break-all">{supportEmail}</p>
          <div className="flex flex-col gap-2 md:flex-row">
            <Button asChild>
              <a href={`mailto:${supportEmail}`}>
                <EnvelopeSimpleIcon aria-hidden="true" />
                Write an email
              </a>
            </Button>
            <CopyTextButton text={supportEmail} label="Copy address" done="Address copied" />
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-4 md:grid md:grid-cols-3 md:gap-6">
        {topics.map((t) => (
          <section key={t.title} className="flex flex-col gap-2.5 border-b border-border pb-4 last:border-b-0 md:rounded-lg md:border md:bg-surface md:p-6 md:last:border-b">
            <h2 className="text-h3">{t.title}</h2>
            <p className="text-sm text-muted">{t.body}</p>
          </section>
        ))}
      </div>
    </div>
  )
}
