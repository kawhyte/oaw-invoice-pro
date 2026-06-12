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
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })

  revalidatePath('/settings')
}
