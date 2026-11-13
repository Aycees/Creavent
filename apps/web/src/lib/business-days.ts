const manilaDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" })

// Weekdays from `since` to `now`, by calendar date in Manila, for the
// approval review target of 1 to 2 business days (spec §2.1).
export function businessDaysSince(since: string, now = new Date()) {
  const day = new Date(`${manilaDate.format(new Date(since))}T00:00:00Z`)
  const end = new Date(`${manilaDate.format(now)}T00:00:00Z`)
  let count = 0
  while (day < end) {
    day.setUTCDate(day.getUTCDate() + 1)
    const weekday = day.getUTCDay()
    if (weekday !== 0 && weekday !== 6) count += 1
  }
  return count
}

export const REVIEW_TARGET_DAYS = 2
