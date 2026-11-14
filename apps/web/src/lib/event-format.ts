import { daysBetween } from "@creavent/shared"

// Dates and times are Manila dates ("2027-01-16") and times ("17:00"), as the
// API sends them. They are formatted as calendar values, so the browser's own
// time zone never shifts them.
const dayFormat = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" })

export function formatDay(date: string) {
  return dayFormat.format(new Date(`${date}T00:00:00Z`))
}

// "17:00" → "5 PM", "12:30" → "12:30 PM".
export function formatTime(time: string) {
  const [h, m] = time.split(":").map(Number)
  const hour = h % 12 === 0 ? 12 : h % 12
  return `${hour}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h < 12 ? "AM" : "PM"}`
}

type Schedule = { startDate: string | null; endDate: string | null; opensAt: string | null; closesAt: string | null }

export function eventDays(s: Schedule) {
  return s.startDate && s.endDate ? daysBetween(s.startDate, s.endDate) + 1 : 0
}

// "Sat, Jan 16 · 5 PM to 11 PM", or "Fri, Jan 15 to Sun, Jan 17 · 4 PM to
// 10 PM daily" for several days (spec §3.1.1).
export function formatSchedule(s: Schedule) {
  if (!s.startDate || !s.endDate || !s.opensAt || !s.closesAt) return null
  const hours = `${formatTime(s.opensAt)} to ${formatTime(s.closesAt)}`
  if (s.startDate === s.endDate) return `${formatDay(s.startDate)} · ${hours}`
  return `${formatDay(s.startDate)} to ${formatDay(s.endDate)} · ${hours} daily`
}

// "Thu, Jan 7, 11:59 PM" for an applications close date ("2027-01-07T23:59").
export function formatDateTime(value: string) {
  const [date, time] = value.split("T")
  return `${formatDay(date)}, ${formatTime(time)}`
}

// A Manila date as a Date for the date stamp (which shows it in Manila).
export function stampDate(date: string) {
  return new Date(`${date}T12:00:00+08:00`)
}
