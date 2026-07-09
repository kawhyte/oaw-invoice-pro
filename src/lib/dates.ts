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
