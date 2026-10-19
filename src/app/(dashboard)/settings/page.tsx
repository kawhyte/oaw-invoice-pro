import { eq } from 'drizzle-orm'
import { db, business_settings } from '@/db'
import { requireUserPage } from '@/lib/session'
import { SettingsForm } from './SettingsForm'
import { resolveLogoUrl } from '@/lib/storage'
import type { BusinessSettings } from '@/types'

export default async function SettingsPage() {
  const user = await requireUserPage()
  const settings = (await db.query.business_settings.findFirst({ where: eq(business_settings.user_id, user.id) })) ?? null

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-bold text-[#1a1c1e]">Settings</h1>
        <p className="text-gray-500 text-sm mt-0.5">Business details used on invoices</p>
      </div>
      <SettingsForm settings={settings ? ({ ...settings, logo_url: await resolveLogoUrl(settings.logo_url) } as BusinessSettings) : null} />
    </div>
  )
}
