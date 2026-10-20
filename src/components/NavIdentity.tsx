import { cache } from 'react'
import { eq } from 'drizzle-orm'
import { db, business_settings } from '@/db'
import { requireUserPage } from '@/lib/session'
import { resolveLogoUrl } from '@/lib/storage'
import { NavDropdown } from '@/components/NavDropdown'

// Logo + business name for the nav. Streamed in (Suspense in the dashboard
// layout) so this cosmetic lookup never delays the first paint. cache():
// rendered twice (sidebar + mobile header) but fetched once per request.
const loadIdentity = cache(async (userId: string) => {
  const s = await db.query.business_settings.findFirst({
    columns: { business_name: true, logo_url: true },
    where: eq(business_settings.user_id, userId),
  })
  return { logoUrl: await resolveLogoUrl(s?.logo_url), businessName: s?.business_name ?? null }
})

export async function NavIdentity({ align }: { align?: 'up' | 'down' }) {
  const user = await requireUserPage()
  const { logoUrl, businessName } = await loadIdentity(user.id)
  return <NavDropdown logoUrl={logoUrl} businessName={businessName} align={align} />
}
