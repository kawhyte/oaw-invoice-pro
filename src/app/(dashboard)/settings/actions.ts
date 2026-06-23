'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

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

export async function saveLogoUrlAction(logoUrl: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  await supabase.from('business_settings').upsert(
    { user_id: user.id, logo_url: logoUrl, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' }
  )
  revalidatePath('/settings')
}

export async function removeLogoAction() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: settings } = await supabase
    .from('business_settings').select('logo_url').eq('user_id', user.id).single()

  if (settings?.logo_url) {
    const { createServiceClient } = await import('@/lib/supabase/service')
    const service = createServiceClient()
    const marker = '/object/public/logos/'
    const idx = settings.logo_url.indexOf(marker)
    if (idx !== -1) {
      const path = decodeURIComponent(
        settings.logo_url.substring(idx + marker.length).split('?')[0]
      )
      await service.storage.from('logos').remove([path])
    }
  }

  await supabase.from('business_settings').update({ logo_url: null }).eq('user_id', user.id)
  revalidatePath('/settings')
}
