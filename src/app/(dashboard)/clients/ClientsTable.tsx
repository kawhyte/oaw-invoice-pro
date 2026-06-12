'use client'
import { useState } from 'react'
import { ClientDialog } from '@/components/clients/ClientDialog'
import type { Client } from '@/types'

export function ClientsTable({ clients }: { clients: Client[] }) {
  const [dialog, setDialog] = useState<{ open: boolean; client?: Client }>({ open: false })

  return (
    <>
      <div className="bg-white rounded-xl border border-[#e0e0e3] shadow-card overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <span className="text-sm font-medium text-gray-700">All Clients</span>
          <button onClick={() => setDialog({ open: true })} className="px-3 py-1.5 text-sm bg-[#715a3e] text-white rounded-lg hover:bg-[#8b7355] transition-colors">
            + New Client
          </button>
        </div>
        {clients.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-400 text-sm">No clients yet. Add your first client.</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {clients.map(client => (
                <tr key={client.id} onClick={() => setDialog({ open: true, client })} className="hover:bg-gray-50 cursor-pointer transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{client.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{client.company ?? '—'}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{client.email ?? '—'}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{client.phone ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {dialog.open && <ClientDialog client={dialog.client} onClose={() => setDialog({ open: false })} />}
    </>
  )
}
