import { asc, eq } from 'drizzle-orm'
import { db, clients as clientsTable } from '@/db'
import { requireUserPage } from '@/lib/session'
import { ClientsTable } from './ClientsTable'
import type { Client } from '@/types'

export default async function ClientsPage() {
  const user = await requireUserPage()
  const clients = await db.select().from(clientsTable)
    .where(eq(clientsTable.user_id, user.id))
    .orderBy(asc(clientsTable.name))

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl font-bold text-[#1a1c1e]">Clients</h1>
          <p className="text-gray-500 text-sm mt-0.5">{clients.length} clients</p>
        </div>
      </div>
      <ClientsTable clients={clients as Client[]} />
    </div>
  )
}
