import { formatDay, formatTime } from "@creavent/shared"

// The schedule formats live in @creavent/shared, so emails read like the
// screens. Re-exported here for the components that already use them.
export { eventDays, formatDay, formatSchedule, formatTime } from "@creavent/shared"

// "Thu, Jan 7, 11:59 PM" for an applications close date ("2027-01-07T23:59").
export function formatDateTime(value: string) {
  const [date, time] = value.split("T")
  return `${formatDay(date)}, ${formatTime(time)}`
}

// A Manila date as a Date for the date stamp (which shows it in Manila).
export function stampDate(date: string) {
  return new Date(`${date}T12:00:00+08:00`)
}

// "Fri, Nov 13 · 9 AM" in Manila time, for deadlines.
const deadlineDay = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", weekday: "short", month: "short", day: "numeric" })
const deadlineTime = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" })
export function formatDeadline(iso: string) {
  const d = new Date(iso)
  return `${deadlineDay.format(d)} · ${deadlineTime.format(d).replace(":00", "")}`
}

// "About 21 hours left", for a payment deadline (spec §6.2).
export function timeLeft(iso: string, now: number) {
  const ms = new Date(iso).getTime() - now
  if (ms <= 0) return "The deadline has passed"
  const hours = Math.floor(ms / 3_600_000)
  if (hours >= 48) return `About ${Math.floor(hours / 24)} days left`
  if (hours >= 1) return `About ${hours} hour${hours === 1 ? "" : "s"} left`
  return `About ${Math.max(1, Math.floor(ms / 60_000))} minutes left`
}
