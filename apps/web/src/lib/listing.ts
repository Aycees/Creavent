// Date helpers for the event listing (spec §7.3). Dates are Manila dates as
// "YYYY-MM-DD" strings, handled as calendar values.

const DAY = 86_400_000

export function addDays(date: string, days: number) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10)
}

const weekdayOf = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay()

// The Saturday of this weekend: the coming one, or the current one on a
// Saturday or Sunday.
export function thisSaturday(today: string) {
  const w = weekdayOf(today)
  return addDays(today, w === 0 ? -1 : 6 - w)
}

type Dated = { startDate: string | null; endDate: string | null }

const overlaps = (e: Dated, from: string, to: string) => Boolean(e.startDate && e.endDate && e.startDate <= to && e.endDate >= from)

export type WeekendGroup<T> = { key: "this" | "next" | "later"; title: string; from: string | null; to: string | null; events: T[] }

// This weekend, Next weekend, and Later. Each event is listed once, in the
// first group any of its days falls in. Empty groups are left out.
export function groupByWeekend<T extends Dated>(events: T[], today: string): WeekendGroup<T>[] {
  const sat = thisSaturday(today)
  const groups: WeekendGroup<T>[] = [
    { key: "this", title: "This weekend", from: sat, to: addDays(sat, 1), events: [] },
    { key: "next", title: "Next weekend", from: addDays(sat, 7), to: addDays(sat, 8), events: [] },
    { key: "later", title: "Later", from: null, to: null, events: [] },
  ]
  for (const e of events) {
    const group = groups.find((g) => g.key === "later" || overlaps(e, g.from!, g.to!))!
    group.events.push(e)
  }
  return groups.filter((g) => g.events.length > 0)
}

// The days of a month grid, whole weeks starting on Sunday.
export function monthDays(month: string) {
  const first = `${month}-01`
  const [y, m] = month.split("-").map(Number)
  const last = new Date(Date.UTC(y!, m!, 0)).toISOString().slice(0, 10)
  const start = addDays(first, -weekdayOf(first))
  const end = addDays(last, 6 - weekdayOf(last))
  const days: { date: string; inMonth: boolean }[] = []
  for (let d = start; d <= end; d = addDays(d, 1)) days.push({ date: d, inMonth: d.startsWith(month) })
  return days
}

export function runsOn(e: Dated, date: string) {
  return overlaps(e, date, date)
}

const monthName = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "long" })

export function nextMonthName(today: string) {
  const [y, m] = today.split("-").map(Number)
  return monthName.format(new Date(Date.UTC(y!, m!, 1)))
}

export function monthLabel(month: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "long", year: "numeric" }).format(new Date(`${month}-01T00:00:00Z`))
}

export function shiftMonth(month: string, by: number) {
  const [y, m] = month.split("-").map(Number)
  return new Date(Date.UTC(y!, m! - 1 + by, 1)).toISOString().slice(0, 7)
}
