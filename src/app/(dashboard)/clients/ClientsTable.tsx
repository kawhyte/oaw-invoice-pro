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
          <>
            <div className="block lg:hidden space-y-3 p-4">
              {clients.map(client => (
                <div key={client.id} onClick={() => setDialog({ open: true, client })}
                  className="block bg-white rounded-xl border border-[#e0e0e3] shadow-[0px_4px_20px_rgba(26,28,30,0.04)] p-4 cursor-pointer">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-[#1a1c1e]">{client.name}</p>
                      {client.company && <p className="text-sm text-[#5a5c62]">{client.company}</p>}
                    </div>
                    {client.currency && (
                      <span className="text-xs font-mono bg-[#f8f9fa] border border-[#e0e0e3] px-2 py-0.5 rounded-full text-[#5a5c62]">
                        {client.currency}
                      </span>
                    )}
                  </div>
                  {client.email && <p className="text-sm text-[#8a8c94] mt-1">{client.email}</p>}
                  {client.phone && <p className="text-sm text-[#8a8c94]">{client.phone}</p>}
                </div>
              ))}
            </div>
            <div className="hidden lg:block">
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
            </div>
          </>
        )}
      </div>
      {dialog.open && <ClientDialog client={dialog.client} onClose={() => setDialog({ open: false })} />}
    </>
  )
}
