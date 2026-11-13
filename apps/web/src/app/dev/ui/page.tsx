import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { ClockIcon, MapPinIcon } from "@phosphor-icons/react/dist/ssr"

import { PhoneHeader } from "@/components/layout/phone-header"
import { StickyActionBar } from "@/components/layout/sticky-action-bar"
import { Alert } from "@/components/ui/alert"
import { ApprovedMark } from "@/components/ui/approved-mark"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge, Tag } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, Panel, Well } from "@/components/ui/card"
import { Container } from "@/components/ui/container"
import { DateStamp } from "@/components/ui/date-stamp"
import { DropZone } from "@/components/ui/drop-zone"
import { Field, InputPrefix } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { KeyValue } from "@/components/ui/key-value"
import { Logo } from "@/components/ui/logo"
import { PhotoPlaceholder } from "@/components/ui/photo-placeholder"
import { SearchInput } from "@/components/ui/search-input"
import { Separator } from "@/components/ui/separator"
import { SlotGrid, SlotTile } from "@/components/ui/slot-tile"
import { ProgressBar, Step, Steps } from "@/components/ui/steps"
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { TextLink } from "@/components/ui/text-link"
import { Textarea } from "@/components/ui/textarea"
import { InteractiveDemos } from "./interactive-demos"

export const metadata: Metadata = { title: "UI kit · Creavent", robots: { index: false } }

// Dev-only showcase of every token and primitive, for comparing against the
// "Creavent UI Mockup (MVP)". Not served in production.
export default function DevUiPage() {
  if (process.env.NODE_ENV === "production") notFound()

  return (
    <Container className="flex flex-col gap-12 py-8 md:py-12">
      <header className="flex flex-col gap-2">
        <Logo />
        <h1 className="text-h1">UI kit</h1>
        <p className="text-muted">Tokens and primitives from the Creavent UI Mockup (MVP). See docs/design-brief.md.</p>
      </header>

      <Section title="Color">
        <SwatchGroup
          title="Surfaces and text"
          swatches={[
            ["canvas", "bg-canvas"], ["surface", "bg-surface"], ["sunken", "bg-sunken"], ["inverse", "bg-inverse"],
            ["ink", "bg-ink"], ["muted", "bg-muted"], ["subtle", "bg-subtle"], ["border", "bg-border"], ["border-strong", "bg-border-strong"],
          ]}
        />
        <SwatchGroup
          title="Brand and status"
          swatches={[
            ["brand", "bg-brand"], ["brand-soft", "bg-brand-soft"], ["brand-ink", "bg-brand-ink"],
            ["success", "bg-success"], ["success-soft", "bg-success-soft"], ["success-ink", "bg-success-ink"],
            ["warning", "bg-warning"], ["warning-soft", "bg-warning-soft"], ["warning-ink", "bg-warning-ink"],
            ["danger", "bg-danger"], ["danger-soft", "bg-danger-soft"], ["danger-ink", "bg-danger-ink"],
            ["info", "bg-info"], ["info-soft", "bg-info-soft"], ["info-ink", "bg-info-ink"],
          ]}
        />
      </Section>

      <Section title="Type">
        <div className="flex flex-col gap-3">
          <p className="text-display">Matina Night Flea</p>
          <p className="text-h1">Events this weekend</p>
          <p className="text-h2">Vendor applications</p>
          <p className="text-h3">Pasalubong and Handmade Fair</p>
          <p className="text-body-lg">Stalls of ukay-ukay, vintage denim, local crafts, plants and street food.</p>
          <p className="text-body">Pay the slot fee by Fri, Nov 13 · 9 AM to keep your spot.</p>
          <p className="text-sm text-muted">Flea market · Damosa Gateway</p>
          <p className="text-label">Slot size</p>
          <p className="text-eyebrow text-muted">Step 2 of 4</p>
          <p className="text-cap text-muted">Updated 2 hours ago</p>
          <p className="text-price tabular-nums">₱1,500</p>
          <p className="text-stat tabular-nums">1,284</p>
          <p className="font-mono text-mono">A-03 · RPT-0142</p>
        </div>
      </Section>

      <Section title="Shape and depth">
        <div className="flex flex-wrap gap-4">
          {["rounded-xs", "rounded-sm", "rounded-md", "rounded-lg", "rounded-xl", "rounded-pill"].map((r) => (
            <div key={r} className={`grid h-16 w-24 place-items-center border border-border-strong bg-surface text-cap text-muted ${r}`}>
              {r.replace("rounded-", "")}
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-6">
          {["shadow-sm", "shadow-md", "shadow-lg"].map((s) => (
            <div key={s} className={`grid h-20 w-32 place-items-center rounded-lg bg-surface text-cap text-muted ${s}`}>
              {s}
            </div>
          ))}
        </div>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="brand">Apply as vendor</Button>
          <Button>Save changes</Button>
          <Button variant="secondary">Cancel</Button>
          <Button variant="ghost">Skip for now</Button>
          <Button variant="danger">Decline</Button>
          <Button variant="danger-ghost">Release slot</Button>
          <Button disabled>Open to vendors</Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm">Approve</Button>
          <Button size="sm" variant="secondary">View proof</Button>
          <Button size="icon" variant="ghost" aria-label="Directions"><MapPinIcon /></Button>
        </div>
      </Section>

      <Section title="Badges and tags">
        <div className="flex flex-wrap gap-2">
          <Badge tone="neutral">Draft</Badge>
          <Badge tone="info">Open to vendors</Badge>
          <Badge tone="info">Proof submitted</Badge>
          <Badge tone="success">Reserved</Badge>
          <Badge tone="warning">Payment due</Badge>
          <Badge tone="danger">Declined</Badge>
          <Badge tone="ink">Admin</Badge>
          <Badge tone="today">Today</Badge>
          <Badge tone="neutral" dot={false}>Flea market</Badge>
          <Badge tone="info" dot={false}>3 days</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          <Tag>Preloved</Tag>
          <Tag>Handmade</Tag>
          <Tag>Food and drinks</Tag>
        </div>
      </Section>

      <Section title="Date stamp and approval">
        <div className="flex flex-wrap items-end gap-4">
          <DateStamp size="sm" date={new Date("2026-11-14T17:00:00+08:00")} />
          <DateStamp date={new Date("2026-11-14T17:00:00+08:00")} />
          <DateStamp size="lg" date={new Date("2026-11-14T17:00:00+08:00")} />
          <DateStamp date={new Date("2026-11-20T09:00:00+08:00")} endDay={22} />
        </div>
        <div className="flex flex-wrap items-center gap-6">
          <ApprovedMark />
          <ApprovedMark compact />
          <ApprovedMark sealOnly />
        </div>
      </Section>

      <Section title="Cards">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))] gap-4 md:gap-6">
          <Card className="overflow-hidden">
            <PhotoPlaceholder label="Event cover · 16:9" />
            <div className="flex gap-3.5 p-4">
              <DateStamp date={new Date("2026-11-14T17:00:00+08:00")} />
              <div className="flex min-w-0 flex-col gap-1">
                <h3 className="text-h3">Matina Night Flea</h3>
                <p className="flex items-center gap-1.5 text-sm text-muted"><ClockIcon aria-hidden="true" className="size-4" />Sat, Nov 14 · 5 PM to 11 PM</p>
                <p className="flex items-center gap-1.5 text-sm text-muted"><MapPinIcon aria-hidden="true" className="size-4" />Matina Town Square</p>
              </div>
            </div>
          </Card>
          <Panel className="flex flex-col gap-4">
            <h3 className="text-h3">Payment</h3>
            <KeyValue
              items={[
                { key: "Slot", value: <span className="font-mono text-mono">B-04</span> },
                { key: "Fee", value: <span className="tabular-nums">₱800</span> },
                { key: "Pay by", value: "Fri, Nov 13 · 9 AM" },
              ]}
            />
            <Well className="text-sm text-muted">
              Pay Sari-Sari Collective directly using either option. Creavent doesn&apos;t hold or process payments.
            </Well>
          </Panel>
          <Card className="flex items-center gap-3 p-4 shadow-none">
            <Avatar size="lg"><AvatarFallback>SC</AvatarFallback></Avatar>
            <div className="flex flex-col">
              <span className="text-label font-semibold">Sari-Sari Collective</span>
              <ApprovedMark link={false} />
            </div>
          </Card>
        </div>
      </Section>

      <Section title="Alerts">
        <div className="flex flex-col gap-3">
          <Alert tone="info">Vendor view. This event is open to vendors. Shoppers can&apos;t see it until the organizer announces it.</Alert>
          <Alert tone="warning">About 21 hours left. Late payments are flagged to the organizer, who may give the slot to someone else.</Alert>
          <Alert tone="success">Payment approved. Slot B-04 is reserved.</Alert>
          <Alert tone="danger">Your application was declined.</Alert>
        </div>
      </Section>

      <Section title="Form">
        <div className="grid max-w-xl gap-5">
          <Field label="Shop name" htmlFor="shop" help="Shown on your vendor page.">
            <Input id="shop" placeholder="Lola's Ukay" aria-describedby="shop-help" />
          </Field>
          <Field label="Mobile number" htmlFor="mobile" optional>
            <InputPrefix prefix="+63">
              <Input id="mobile" inputMode="tel" placeholder="917 123 4567" />
            </InputPrefix>
          </Field>
          <Field label="About your shop" htmlFor="about" required>
            <Textarea id="about" />
          </Field>
          <Field label="Email" htmlFor="email" error="Enter an email address, like name@example.com.">
            <Input id="email" aria-invalid aria-describedby="email-error" defaultValue="lola@" />
          </Field>
          <DropZone id="permit" prompt="Drop your permit here, or choose a file" hint="JPG, PNG, or PDF · up to 10 MB" accept="image/jpeg,image/png,application/pdf" />
          <SearchInput aria-label="Search organizers" placeholder="Search organizers" />
        </div>
      </Section>

      <InteractiveDemos />

      <Section title="Table">
        <Table>
          <TableCaption>Slots and fees</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Slot</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Fee</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-mono text-mono">A-03</TableCell>
              <TableCell>Lola&apos;s Ukay</TableCell>
              <TableCell><Badge tone="success">Reserved</Badge></TableCell>
              <TableCell className="text-right tabular-nums">₱800</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-mono text-mono">B-04</TableCell>
              <TableCell>Paper Bayani</TableCell>
              <TableCell><Badge tone="warning">Payment due</Badge></TableCell>
              <TableCell className="text-right tabular-nums">₱1,500</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-mono text-mono">A-04 to A-16</TableCell>
              <TableCell className="text-muted">13 more</TableCell>
              <TableCell><Badge tone="neutral">Open</Badge></TableCell>
              <TableCell className="text-right tabular-nums">₱800</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Section>

      <Section title="Slots">
        <SlotGrid className="max-w-xl">
          <SlotTile code="A-01" state="reserved" />
          <SlotTile code="A-02" state="assigned" />
          <SlotTile code="A-03" state="due" />
          <SlotTile code="A-04" state="open" />
          <SlotTile code="A-05" state="open" />
        </SlotGrid>
      </Section>

      <Section title="Steps">
        <div className="grid max-w-xl gap-6">
          <ProgressBar step={2} total={4} />
          <Steps>
            <Step state="done" title="Applied">Thu, Nov 5</Step>
            <Step state="done" title="Slot assigned">B-04 · Pay by Fri, Nov 13 · 9 AM</Step>
            <Step state="now" title="Proof submitted">Waiting for the organizer</Step>
            <Step title="Reserved" />
          </Steps>
        </div>
      </Section>

      <Section title="Avatars and photos">
        <div className="flex items-center gap-4">
          <Avatar><AvatarFallback>LU</AvatarFallback></Avatar>
          <Avatar size="lg"><AvatarFallback>LU</AvatarFallback></Avatar>
          <Avatar size="xl"><AvatarFallback>LU</AvatarFallback></Avatar>
        </div>
        <div className="grid max-w-xl grid-cols-2 gap-4">
          <PhotoPlaceholder ratio="3/2" label="Event cover · 3:2" className="rounded-xl" />
          <PhotoPlaceholder ratio="1/1" label="Vendor photo" className="rounded-lg" />
        </div>
      </Section>

      <Section title="Phone header and sticky action bar">
        <p className="text-sm text-muted">The bar is fixed to the screen in pages; shown in place here.</p>
        <div className="w-full max-w-[390px] overflow-hidden rounded-xl border border-border bg-canvas">
          <PhoneHeader title="Bajada Christmas Flea" backHref="/dev/ui" backLabel="Back to events" />
          <p className="p-4 text-sm text-muted">Page content</p>
          <StickyActionBar className="static">
            <div className="min-w-0 flex-1">
              <p className="text-label font-semibold">Sat, Dec 12 · 9 AM</p>
              <p className="text-cap text-muted">Bajada Covered Court</p>
            </div>
            <Button>Get directions</Button>
          </StickyActionBar>
        </div>
      </Section>

      <Separator />
      <p className="text-sm text-muted">
        Inline links look like <TextLink href="/">this one</TextLink>.
      </p>
    </Container>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-h2">{title}</h2>
      {children}
    </section>
  )
}

function SwatchGroup({ title, swatches }: { title: string; swatches: [string, string][] }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-label text-muted">{title}</h3>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-3">
        {swatches.map(([name, cls]) => (
          <div key={name} className="flex flex-col gap-1.5">
            <div className={`h-12 rounded-md border ${cls}`} />
            <span className="font-mono text-cap text-muted">{name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
