'use client'
import { useRef, useState, useTransition } from 'react'
import { createClientAction, updateClientAction, deleteClientAction } from '@/app/(dashboard)/clients/actions'
import type { Client } from '@/types'

interface Props {
  client?: Client
  onClose: () => void
}

export function ClientDialog({ client, onClose }: Props) {
  const formRef = useRef<HTMLFormElement>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      if (client) await updateClientAction(client.id, formData)
      else await createClientAction(formData)
      onClose()
    })
  }

  function handleDelete() {
    if (!client) return
    if (!confirm('Delete this client? This cannot be undone.')) return
    startTransition(async () => {
      await deleteClientAction(client.id)
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md shadow-card">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="font-semibold text-gray-900">{client ? 'Edit Client' : 'New Client'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <form ref={formRef} onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-1">Name *</label>
            <input name="name" required defaultValue={client?.name}
              className="w-full px-3 py-2 border border-[#e0e0e3] rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#715a3e] focus:border-[#715a3e]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-1">Email</label>
            <input name="email" type="email" defaultValue={client?.email ?? ''}
              className="w-full px-3 py-2 border border-[#e0e0e3] rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#715a3e] focus:border-[#715a3e]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-1">Phone</label>
            <input name="phone" defaultValue={client?.phone ?? ''}
              className="w-full px-3 py-2 border border-[#e0e0e3] rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#715a3e] focus:border-[#715a3e]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-1">Company</label>
            <input name="company" defaultValue={client?.company ?? ''}
              className="w-full px-3 py-2 border border-[#e0e0e3] rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#715a3e] focus:border-[#715a3e]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-1">Address</label>
            <input name="address" defaultValue={client?.address ?? ''}
              className="w-full px-3 py-2 border border-[#e0e0e3] rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#715a3e] focus:border-[#715a3e]" />
          </div>
          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs text-gray-400 mb-3">Optional billing info</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">Currency</label>
                <select name="currency" defaultValue={client?.currency ?? ''}
                  className="select-field w-full px-3 py-2 border border-[#e0e0e3] rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#715a3e] focus:border-[#715a3e]">
                  <option value="">— Select —</option>
                  <option value="JMD">JMD</option>
                  <option value="USD">USD</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">Country</label>
                <input name="country" defaultValue={client?.country ?? ''}
                  placeholder="e.g. Jamaica"
                  className="w-full px-3 py-2 border border-[#e0e0e3] rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#715a3e] focus:border-[#715a3e]" />
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between pt-2">
            {client ? (
              <button type="button" onClick={handleDelete} disabled={isPending} className="text-sm text-red-500 hover:text-red-700 disabled:opacity-50">Delete</button>
            ) : <div />}
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
              <button type="submit" disabled={isPending} className="px-4 py-2 text-sm bg-[#715a3e] text-white rounded-lg hover:bg-[#8b7355] disabled:opacity-50">
                {isPending ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
