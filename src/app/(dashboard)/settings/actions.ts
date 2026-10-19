'use server'
import { createClient } from '@/lib/supabase/server'
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
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  if (contentType !== 'image/png' && contentType !== 'image/jpeg') throw new Error('PNG or JPG only')
  if (sizeBytes <= 0 || sizeBytes > 2 * 1024 * 1024) throw new Error('Logo must be under 2 MB')
  const key = `logos/${user.id}/logo-${Date.now()}.${contentType === 'image/png' ? 'png' : 'jpg'}`
  return { key, url: await signedPutUrl(key, contentType, sizeBytes) }
}

export async function saveSettingsAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  await supabase.from('business_settings').upsert({
    user_id: user.id,
    business_name: (formData.get('business_name') as string) || null,
    owner_name: (formData.get('owner_name') as string) || null,
    email: (formData.get('email') as string) || null,
    phone: (formData.get('phone') as string) || null,
    address: (formData.get('address') as string) || null,
    max_workload: formData.get('max_workload') ? Number(formData.get('max_workload')) : null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })

  revalidatePath('/settings')
  revalidatePath('/dashboard')
}

/** Saves an uploaded logo's key, deletes the previous logo object, and returns a displayable URL. */
export async function saveLogoAction(key: string): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  if (!key.startsWith(`logos/${user.id}/`)) throw new Error('Invalid logo path')
  const { data: current } = await supabase
    .from('business_settings').select('logo_url').eq('user_id', user.id).maybeSingle()
  const { error } = await supabase.from('business_settings').upsert(
    { user_id: user.id, logo_url: key, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' }
  )
  if (error) throw new Error('Could not save the logo.')
  const old = logoKeyFrom(current?.logo_url)
  if (old && old !== key) await removeObjects([old])
  revalidatePath('/settings')
  revalidatePath('/', 'layout')
  return resolveLogoUrl(key)
}

export async function removeLogoAction() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: settings } = await supabase
    .from('business_settings').select('logo_url').eq('user_id', user.id).single()

  const key = logoKeyFrom(settings?.logo_url)
  if (key) await removeObjects([key])

  await supabase.from('business_settings').update({ logo_url: null }).eq('user_id', user.id)
  revalidatePath('/settings')
  revalidatePath('/', 'layout')
}
