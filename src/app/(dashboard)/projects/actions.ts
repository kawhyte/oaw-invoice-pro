'use server'
import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db, projects } from '@/db'
import { requireUser } from '@/lib/session'
import { geocodeAddress } from '@/lib/geocode'
import type { ProjectStatus } from '@/types'

// `existing` is the saved project when editing: an unchanged address keeps its
// saved coordinates instead of re-geocoding, so a slow or failing lookup can't
// block the save or wipe the project off the map.
async function projectFields(formData: FormData, existing?: { location_address: string | null; lat: number | null; lng: number | null }) {
  const address = formData.get('location_address') as string
  const unchanged = existing && (existing.location_address ?? '') === (address || '') && existing.lat !== null && existing.lng !== null
  const coords = unchanged ? { lat: existing.lat!, lng: existing.lng! } : address ? await geocodeAddress(address) : null
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
  revalidatePath('/dashboard')
  return { geocoded }
}

export async function updateProjectAction(id: string, formData: FormData): Promise<{ geocoded: boolean }> {
  const user = await requireUser()
  const [existing] = await db.select({ location_address: projects.location_address, lat: projects.lat, lng: projects.lng })
    .from(projects).where(and(eq(projects.id, id), eq(projects.user_id, user.id))).limit(1)
  if (!existing) throw new Error('Not found')
  const { geocoded, fields } = await projectFields(formData, existing)
  await db.update(projects).set({ ...fields, updated_at: new Date().toISOString() })
    .where(and(eq(projects.id, id), eq(projects.user_id, user.id)))
  revalidatePath('/projects')
  revalidatePath(`/projects/${id}`)
  revalidatePath('/dashboard')
  return { geocoded }
}

// One-tap status change from the project page (Mark job complete / Reopen).
export async function setProjectStatusAction(id: string, status: ProjectStatus) {
  const user = await requireUser()
  await db.update(projects).set({ status, updated_at: new Date().toISOString() })
    .where(and(eq(projects.id, id), eq(projects.user_id, user.id)))
  revalidatePath('/projects')
  revalidatePath(`/projects/${id}`)
  revalidatePath('/dashboard')
}

export async function deleteProjectAction(id: string) {
  const user = await requireUser()
  await db.delete(projects).where(and(eq(projects.id, id), eq(projects.user_id, user.id)))
  revalidatePath('/projects')
  revalidatePath('/dashboard')
}

export async function rotateShareTokenAction(id: string) {
  const user = await requireUser()
  await db.update(projects).set({ share_token: crypto.randomUUID() })
    .where(and(eq(projects.id, id), eq(projects.user_id, user.id)))
  revalidatePath(`/projects/${id}`)
}
