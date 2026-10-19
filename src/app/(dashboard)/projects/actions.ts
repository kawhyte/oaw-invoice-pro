'use server'
import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db, projects } from '@/db'
import { requireUser } from '@/lib/session'
import { geocodeAddress } from '@/lib/geocode'
import type { ProjectStatus } from '@/types'

async function projectFields(formData: FormData) {
  const address = formData.get('location_address') as string
  const coords = address ? await geocodeAddress(address) : null
  const isPersonal = formData.get('is_personal') === 'true'
  const budgetRaw = formData.get('budget') as string
  return {
    geocoded: !address || coords !== null,
    fields: {
      client_id: isPersonal ? null : (formData.get('client_id') as string),
      is_personal: isPersonal,
      budget: isPersonal && budgetRaw ? Number(budgetRaw) : null,
      title: formData.get('title') as string,
      description: (formData.get('description') as string) || null,
      status: formData.get('status') as ProjectStatus,
      job_type: (formData.get('job_type') as string) || null,
      location_address: address || null,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
    },
  }
}

export async function createProjectAction(formData: FormData): Promise<{ geocoded: boolean }> {
  const user = await requireUser()
  const { geocoded, fields } = await projectFields(formData)
  await db.insert(projects).values({ user_id: user.id, ...fields })
  revalidatePath('/projects')
  return { geocoded }
}

export async function updateProjectAction(id: string, formData: FormData): Promise<{ geocoded: boolean }> {
  const user = await requireUser()
  const { geocoded, fields } = await projectFields(formData)
  await db.update(projects).set({ ...fields, updated_at: new Date().toISOString() })
    .where(and(eq(projects.id, id), eq(projects.user_id, user.id)))
  revalidatePath('/projects')
  revalidatePath(`/projects/${id}`)
  return { geocoded }
}

export async function deleteProjectAction(id: string) {
  const user = await requireUser()
  await db.delete(projects).where(and(eq(projects.id, id), eq(projects.user_id, user.id)))
  revalidatePath('/projects')
}

export async function rotateShareTokenAction(id: string) {
  const user = await requireUser()
  await db.update(projects).set({ share_token: crypto.randomUUID() })
    .where(and(eq(projects.id, id), eq(projects.user_id, user.id)))
  revalidatePath(`/projects/${id}`)
}
