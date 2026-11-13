"use client"

import * as React from "react"
import Link from "next/link"
import { CalendarBlankIcon, ListBulletsIcon } from "@phosphor-icons/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { ChoiceCard } from "@/components/ui/choice-card"
import { Chip } from "@/components/ui/chip"
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Field } from "@/components/ui/field"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Segmented, SegmentedItem } from "@/components/ui/segmented"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { TabCount, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const filters = [
  ["All", 32],
  ["Preloved", 14],
  ["Handmade", 7],
  ["Vintage", 6],
] as const

export function InteractiveDemos() {
  const [filter, setFilter] = React.useState("All")
  const [view, setView] = React.useState<"list" | "calendar">("list")
  const [role, setRole] = React.useState("vendor")

  return (
    <>
      <section className="flex flex-col gap-4">
        <h2 className="text-h2">Chips and switches</h2>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {filters.map(([name, count]) => (
            <Chip key={name} pressed={filter === name} count={count} onClick={() => setFilter(name)}>
              {name}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap gap-4">
          <Segmented aria-label="View">
            <SegmentedItem active={view === "list"} onClick={() => setView("list")}><ListBulletsIcon aria-hidden="true" />List</SegmentedItem>
            <SegmentedItem active={view === "calendar"} onClick={() => setView("calendar")}><CalendarBlankIcon aria-hidden="true" />Calendar</SegmentedItem>
          </Segmented>
          <Segmented aria-label="Role">
            <SegmentedItem asChild active><Link href="#">Vendor</Link></SegmentedItem>
            <SegmentedItem asChild><Link href="#">Organizer</Link></SegmentedItem>
          </Segmented>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-h2">Choices</h2>
        <fieldset className="m-0 grid max-w-xl gap-3 border-0 p-0">
          <legend className="mb-3 text-label">What do you want to do?</legend>
          <RadioGroup value={role} onValueChange={setRole}>
            <ChoiceCard>
              <RadioGroupItem value="vendor" aria-describedby="vendor-desc" />
              <span className="flex flex-col gap-0.5">
                <span className="text-label font-semibold">Sell at events</span>
                <span id="vendor-desc" className="text-sm text-muted">Find flea markets and apply for a slot.</span>
              </span>
            </ChoiceCard>
            <ChoiceCard>
              <RadioGroupItem value="organizer" aria-describedby="organizer-desc" />
              <span className="flex flex-col gap-0.5">
                <span className="text-label font-semibold">Run events</span>
                <span id="organizer-desc" className="text-sm text-muted">Create events and assign slots to vendors.</span>
              </span>
            </ChoiceCard>
          </RadioGroup>
        </fieldset>
        <ChoiceCard className="max-w-xl">
          <Checkbox defaultChecked />
          <span className="text-sm">I am 18 or older and agree to the Terms and Privacy notice.</span>
        </ChoiceCard>
        <Field label="Event type" htmlFor="event-type" className="max-w-xl">
          <Select defaultValue="flea">
            <SelectTrigger id="event-type"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="flea">Flea market</SelectItem>
              <SelectItem value="bazaar">Bazaar</SelectItem>
              <SelectItem value="popup">Pop-up</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-h2">Tabs</h2>
        <Tabs defaultValue="details">
          <TabsList>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="slots">Slots <TabCount>24</TabCount></TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
          </TabsList>
          <TabsContent value="details" className="text-muted">Event name, dates, and place.</TabsContent>
          <TabsContent value="slots" className="text-muted">24 slots in 3 sizes.</TabsContent>
          <TabsContent value="payments" className="text-muted">GCash and bank transfer.</TabsContent>
        </Tabs>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-h2">Overlays</h2>
        <div className="flex flex-wrap gap-3">
          <Dialog>
            <DialogTrigger asChild><Button variant="secondary">Open dialog</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Approve payment?</DialogTitle>
                <DialogDescription>Approving reserves B-04 and emails Lola&apos;s Ukay.</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild><Button variant="secondary">Cancel</Button></DialogClose>
                <DialogClose asChild><Button onClick={() => toast("Payment approved. B-04 is reserved.")}>Approve</Button></DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Sheet>
            <SheetTrigger asChild><Button variant="secondary">Open bottom sheet</Button></SheetTrigger>
            <SheetContent side="bottom">
              <SheetHeader>
                <SheetTitle>Proof of payment</SheetTitle>
                <SheetDescription>Lola&apos;s Ukay · B-04 · ₱800 by GCash</SheetDescription>
              </SheetHeader>
              <SheetFooter className="flex-row">
                <Button variant="secondary" className="flex-1">Reject</Button>
                <Button className="flex-1">Approve</Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>

          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="secondary">Open menu</Button></DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuItem>Account</DropdownMenuItem>
              <DropdownMenuItem>Vendor profile</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Sign out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="secondary" onClick={() => toast("Link copied")}>Show toast</Button>
        </div>
      </section>
    </>
  )
}
