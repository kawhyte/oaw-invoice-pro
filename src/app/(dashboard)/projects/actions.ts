'use server'
import { createClient } from '@/lib/supabase/server'
import { geocodeAddress } from '@/lib/geocode'
import { revalidatePath } from 'next/cache'

export async function createProjectAction(formData: FormData): Promise<{ geocoded: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const address = formData.get('location_address') as string
  const coords = address ? await geocodeAddress(address) : null
  const isPersonal = formData.get('is_personal') === 'true'
  const budgetRaw = formData.get('budget') as string

  await supabase.from('projects').insert({
    user_id: user.id,
    client_id: isPersonal ? null : (formData.get('client_id') as string),
    is_personal: isPersonal,
    budget: isPersonal && budgetRaw ? Number(budgetRaw) : null,
    title: formData.get('title') as string,
    description: formData.get('description') as string || null,
    status: formData.get('status') as string,
    job_type: formData.get('job_type') as string || null,
    location_address: address || null,
    lat: coords?.lat ?? null,
    lng: coords?.lng ?? null,
  })
  revalidatePath('/projects')
  return { geocoded: !address || coords !== null }
}

export async function updateProjectAction(id: string, formData: FormData): Promise<{ geocoded: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const address = formData.get('location_address') as string
  const coords = address ? await geocodeAddress(address) : null
  const isPersonal = formData.get('is_personal') === 'true'
  const budgetRaw = formData.get('budget') as string

  await supabase.from('projects').update({
    client_id: isPersonal ? null : (formData.get('client_id') as string),
    is_personal: isPersonal,
    budget: isPersonal && budgetRaw ? Number(budgetRaw) : null,
    title: formData.get('title') as string,
    description: formData.get('description') as string || null,
    status: formData.get('status') as string,
    job_type: formData.get('job_type') as string || null,
    location_address: address || null,
    lat: coords?.lat ?? null,
    lng: coords?.lng ?? null,
    updated_at: new Date().toISOString(),
  }).eq('id', id).eq('user_id', user.id)
  revalidatePath('/projects')
  revalidatePath(`/projects/${id}`)
  return { geocoded: !address || coords !== null }
}

export async function deleteProjectAction(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  await supabase.from('projects').delete().eq('id', id).eq('user_id', user.id)
  revalidatePath('/projects')
}

export async function rotateShareTokenAction(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  await supabase.rpc('gen_random_uuid').then(async () => {
    await supabase
      .from('projects')
      .update({ share_token: crypto.randomUUID() })
      .eq('id', id)
      .eq('user_id', user.id)
  })
  revalidatePath(`/projects/${id}`)
}
