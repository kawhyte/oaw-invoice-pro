'use server'
import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db, clients } from '@/db'
import { requireUser } from '@/lib/session'
import type { Currency } from '@/types'

function clientFields(formData: FormData) {
  return {
    name: formData.get('name') as string,
    email: (formData.get('email') as string) || null,
    phone: (formData.get('phone') as string) || null,
    company: (formData.get('company') as string) || null,
    address: (formData.get('address') as string) || null,
    currency: ((formData.get('currency') as string) || null) as Currency | null,
    country: (formData.get('country') as string) || null,
  }
}

export async function createClientAction(formData: FormData) {
  const user = await requireUser()
  await db.insert(clients).values({ user_id: user.id, ...clientFields(formData) })
  revalidatePath('/clients')
}

export async function updateClientAction(id: string, formData: FormData) {
  const user = await requireUser()
  await db.update(clients).set(clientFields(formData)).where(and(eq(clients.id, id), eq(clients.user_id, user.id)))
  revalidatePath('/clients')
}

export async function deleteClientAction(id: string) {
  const user = await requireUser()
  await db.delete(clients).where(and(eq(clients.id, id), eq(clients.user_id, user.id)))
  revalidatePath('/clients')
}
