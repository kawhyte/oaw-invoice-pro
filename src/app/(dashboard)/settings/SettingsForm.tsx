'use client'
import { useTransition } from 'react'
import { saveSettingsAction } from './actions'
import type { BusinessSettings } from '@/types'

export function SettingsForm({ settings }: { settings: BusinessSettings | null }) {
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => { await saveSettingsAction(fd) })
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4 max-w-lg">
      <h2 className="text-sm font-semibold text-gray-900">Business Information</h2>
      <p className="text-xs text-gray-500">This information appears on all generated invoices.</p>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Business Name</label>
        <input name="business_name" defaultValue={settings?.business_name ?? ''}
          placeholder="e.g. OAW Construction Ltd"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Your Name</label>
        <input name="owner_name" defaultValue={settings?.owner_name ?? ''}
          placeholder="e.g. Omar A. Whyte"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input name="email" type="email" defaultValue={settings?.email ?? ''}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
          <input name="phone" defaultValue={settings?.phone ?? ''}
            placeholder="+1 876 000 0000"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
        <input name="address" defaultValue={settings?.address ?? ''}
          placeholder="123 Main St, Kingston, Jamaica"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <button type="submit" disabled={isPending}
        className="px-6 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">
        {isPending ? 'Saving...' : 'Save Settings'}
      </button>
    </form>
  )
}
