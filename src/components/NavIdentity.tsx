import { cache } from 'react'
import { eq } from 'drizzle-orm'
import { db, business_settings } from '@/db'
import { requireUserPage } from '@/lib/session'
import { NavDropdown } from '@/components/NavDropdown'

// Logo + business name for the nav. Streamed in (Suspense in the dashboard
// layout) so this cosmetic lookup never delays the first paint. cache():
// rendered twice (sidebar + mobile header) but fetched once per request.
const loadIdentity = cache(async (userId: string) => {
  const s = await db.query.business_settings.findFirst({
    columns: { business_name: true, logo_url: true },
    where: eq(business_settings.user_id, userId),
  })
  const logo = s?.logo_url
  // Legacy absolute URLs are used as-is; storage keys go through the cacheable
  // same-origin /api/logo (the key versions the URL, so a new upload busts it).
  const logoUrl = !logo ? null
    : /^https?:\/\//.test(logo) ? logo.split('?')[0]
    : `/api/logo?v=${encodeURIComponent(logo.split('/').pop() ?? logo)}`
  return { logoUrl, businessName: s?.business_name ?? null }
})

export async function NavIdentity({ align }: { align?: 'up' | 'down' }) {
  const user = await requireUserPage()
  const { logoUrl, businessName } = await loadIdentity(user.id)
  return <NavDropdown logoUrl={logoUrl} businessName={businessName} align={align} />
}
