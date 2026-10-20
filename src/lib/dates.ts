/**
 * "Today" as a YYYY-MM-DD string in the business's timezone.
 *
 * The app's date-only fields (due_date, paid_date) are plain date strings and
 * all comparisons are string vs string, so "today" must be Jamaica's calendar
 * date — NOT the server's. Vercel runs in UTC, which rolls to tomorrow at
 * 7:00 PM Jamaica time; using toISOString() flagged invoices overdue a day
 * early every evening.
 *
 * America/Jamaica is UTC-5 with no DST, and 'en-CA' formats as YYYY-MM-DD.
 * Safe in both server and client bundles (no Node-only APIs).
 */
export const BUSINESS_TIMEZONE = 'America/Jamaica'

export function todayInBusinessTz(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TIMEZONE }).format(new Date())
}

/** YYYY-MM-DD plus n calendar days (pure date math; no timezone involved). */
export function addDaysToDate(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

/** Whole days from a to b (b − a), both YYYY-MM-DD. */
export function daysBetween(a: string, b: string): number {
  const t = (s: string) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d) }
  return Math.round((t(b) - t(a)) / 864e5)
}

/** True for a well-formed YYYY-MM-DD calendar date. */
export function isDateString(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  return addDaysToDate(s, 0) === s
}
