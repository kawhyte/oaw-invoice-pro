'use server'
import { eq } from 'drizzle-orm'
import { db, business_settings } from '@/db'
import { requireUser } from '@/lib/session'
import { revalidatePath } from 'next/cache'
import { signedPutUrl, removeObjects, resolveLogoUrl } from '@/lib/storage'

// logo_url holds a storage key ("logos/<uid>/logo-<ts>.png") for new uploads,
// or a legacy Supabase public URL until the migration script rewrites it.
function logoKeyFrom(value: string | null | undefined): string | null {
  if (!value) return null
  if (!/^https?:\/\//.test(value)) return value
  return null // legacy Supabase URL — the object lives in Supabase; nothing to delete here
}

export async function createLogoUploadAction(contentType: string, sizeBytes: number) {
  const user = await requireUser()
  if (contentType !== 'image/png' && contentType !== 'image/jpeg') throw new Error('PNG or JPG only')
  if (sizeBytes <= 0 || sizeBytes > 2 * 1024 * 1024) throw new Error('Logo must be under 2 MB')
  const key = `logos/${user.id}/logo-${Date.now()}.${contentType === 'image/png' ? 'png' : 'jpg'}`
  return { key, url: await signedPutUrl(key, contentType, sizeBytes) }
}

export async function saveSettingsAction(formData: FormData) {
  const user = await requireUser()

  const fields = {
    business_name: (formData.get('business_name') as string) || null,
    owner_name: (formData.get('owner_name') as string) || null,
    email: (formData.get('email') as string) || null,
    phone: (formData.get('phone') as string) || null,
    address: (formData.get('address') as string) || null,
    max_workload: formData.get('max_workload') ? Number(formData.get('max_workload')) : null,
    updated_at: new Date().toISOString(),
  }
  await db.insert(business_settings).values({ user_id: user.id, ...fields })
    .onConflictDoUpdate({ target: business_settings.user_id, set: fields })

  revalidatePath('/settings')
  revalidatePath('/dashboard')
}

/** Saves an uploaded logo's key, deletes the previous logo object, and returns a displayable URL. */
export async function saveLogoAction(key: string): Promise<string | null> {
  const user = await requireUser()
  if (!key.startsWith(`logos/${user.id}/`)) throw new Error('Invalid logo path')
  const current = await db.query.business_settings.findFirst({ columns: { logo_url: true }, where: eq(business_settings.user_id, user.id) })
  const updated_at = new Date().toISOString()
  await db.insert(business_settings).values({ user_id: user.id, logo_url: key, updated_at })
    .onConflictDoUpdate({ target: business_settings.user_id, set: { logo_url: key, updated_at } })
  const old = logoKeyFrom(current?.logo_url)
  if (old && old !== key) await removeObjects([old])
  revalidatePath('/settings')
  revalidatePath('/', 'layout')
  return resolveLogoUrl(key)
}

export async function removeLogoAction() {
  const user = await requireUser()

  const settings = await db.query.business_settings.findFirst({ columns: { logo_url: true }, where: eq(business_settings.user_id, user.id) })

  const key = logoKeyFrom(settings?.logo_url)
  if (key) await removeObjects([key])

  await db.update(business_settings).set({ logo_url: null }).where(eq(business_settings.user_id, user.id))
  revalidatePath('/settings')
  revalidatePath('/', 'layout')
}
