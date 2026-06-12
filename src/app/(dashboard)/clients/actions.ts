'use server'
import { createClient as createSupabaseClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createClientAction(formData: FormData) {
  const supabase = await createSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  await supabase.from('clients').insert({
    user_id: user.id,
    name: formData.get('name') as string,
    email: formData.get('email') as string || null,
    phone: formData.get('phone') as string || null,
    currency: formData.get('currency') as string,
    country: formData.get('country') as string,
  })
  revalidatePath('/clients')
}

export async function updateClientAction(id: string, formData: FormData) {
  const supabase = await createSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  await supabase.from('clients').update({
    name: formData.get('name') as string,
    email: formData.get('email') as string || null,
    phone: formData.get('phone') as string || null,
    currency: formData.get('currency') as string,
    country: formData.get('country') as string,
  }).eq('id', id).eq('user_id', user.id)
  revalidatePath('/clients')
}

export async function deleteClientAction(id: string) {
  const supabase = await createSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  await supabase.from('clients').delete().eq('id', id).eq('user_id', user.id)
  revalidatePath('/clients')
}
