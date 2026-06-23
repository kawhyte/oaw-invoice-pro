'use client'
import { useState, useRef, useTransition } from 'react'
import { saveSettingsAction, saveLogoUrlAction, removeLogoAction } from './actions'
import { createClient } from '@/lib/supabase/client'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import type { BusinessSettings } from '@/types'

export function SettingsForm({ settings }: { settings: BusinessSettings | null }) {
  const [isPending, startTransition] = useTransition()
  const confirm = useConfirm()
  const [logoUrl, setLogoUrl] = useState<string | null>(settings?.logo_url ?? null)
  const [logoUploading, setLogoUploading] = useState(false)
  const [logoError, setLogoError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => { await saveSettingsAction(fd) })
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
      setLogoError('PNG or JPG only.')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setLogoError('File must be under 2MB.')
      return
    }
    setLogoError(null)
    setLogoUploading(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const ext = file.type === 'image/png' ? 'png' : 'jpg'
      const timestamp = Date.now()
      const path = `${user.id}/logo-${timestamp}.${ext}`

      // Delete old logo file if one exists
      const { data: currentSettings } = await supabase
        .from('business_settings')
        .select('logo_url')
        .eq('user_id', user.id)
        .single()

      if (currentSettings?.logo_url) {
        const marker = '/object/public/logos/'
        const idx = currentSettings.logo_url.indexOf(marker)
        if (idx !== -1) {
          const oldPath = decodeURIComponent(
            currentSettings.logo_url.substring(idx + marker.length).split('?')[0]
          )
          await supabase.storage.from('logos').remove([oldPath])
        }
      }

      const { error } = await supabase.storage.from('logos').upload(path, file, { upsert: true })
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(path)
      const urlWithBust = publicUrl
      await saveLogoUrlAction(urlWithBust)
      setLogoUrl(urlWithBust)
    } catch (err: any) {
      setLogoError(err.message ?? 'Upload failed.')
    } finally {
      setLogoUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleRemoveLogo() {
    if (!(await confirm({ title: 'Remove your logo?', description: 'Your invoices and header will fall back to your business initials.', confirmLabel: 'Remove', variant: 'danger' }))) return
    startTransition(async () => {
      await removeLogoAction()
      setLogoUrl(null)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-[#e0e0e3] shadow-card p-6 space-y-5 max-w-lg">
      <div>
        <h2 className="text-sm font-semibold text-gray-900">Business Information</h2>
        <p className="text-xs text-gray-500 mt-0.5">This information appears on all generated invoices.</p>
      </div>

      {/* Logo */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Business Logo</label>
        <div className="flex items-center gap-4">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="h-16 max-w-[160px] w-auto object-contain rounded-lg border border-gray-200 bg-gray-50 p-2" />
          ) : (
            <div className="h-16 w-16 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50">
              <span className="text-2xl text-gray-300">🏢</span>
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <input ref={fileInputRef} id="logo-upload" type="file" accept="image/png,image/jpeg,image/jpg" onChange={handleLogoUpload} className="hidden" />
            <label htmlFor="logo-upload"
              className={`inline-flex px-3 py-1.5 text-sm border border-[#e0e0e3] rounded-lg cursor-pointer hover:bg-gray-50 transition-colors ${logoUploading ? 'opacity-50 pointer-events-none' : ''}`}>
              {logoUploading ? 'Uploading...' : logoUrl ? 'Change Logo' : 'Upload Logo'}
            </label>
            {logoUrl && (
              <button type="button" onClick={handleRemoveLogo} disabled={isPending}
                className="text-xs text-red-500 hover:text-red-700 text-left disabled:opacity-50">
                Remove
              </button>
            )}
          </div>
        </div>
        <div className="mt-2 space-y-0.5">
          <p className="text-xs text-gray-500 font-medium">Logo requirements:</p>
          <p className="text-xs text-gray-400">• PNG preferred (supports transparent background)</p>
          <p className="text-xs text-gray-400">• Square logo: min 400×400px</p>
          <p className="text-xs text-gray-400">• Wide logo: min 600×200px</p>
          <p className="text-xs text-gray-400">• Max file size: 2MB</p>
        </div>
        {logoError && <p className="text-xs text-red-500 mt-1">{logoError}</p>}
      </div>

      {/* Fields */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Business Name</label>
        <input name="business_name" defaultValue={settings?.business_name ?? ''}
          placeholder="e.g. OW Construction Ltd"
          className="w-full px-3 py-2 border border-[#e0e0e3] rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#715a3e] focus:border-[#715a3e]" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Your Name</label>
        <input name="owner_name" defaultValue={settings?.owner_name ?? ''}
          placeholder="e.g. Omar A. Whyte"
          className="w-full px-3 py-2 border border-[#e0e0e3] rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#715a3e] focus:border-[#715a3e]" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input name="email" type="email" defaultValue={settings?.email ?? ''}
            className="w-full px-3 py-2 border border-[#e0e0e3] rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#715a3e] focus:border-[#715a3e]" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
          <input name="phone" defaultValue={settings?.phone ?? ''}
            placeholder="+1 876 000 0000"
            className="w-full px-3 py-2 border border-[#e0e0e3] rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#715a3e] focus:border-[#715a3e]" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
        <input name="address" defaultValue={settings?.address ?? ''}
          placeholder="123 Main St, Kingston, Jamaica"
          className="w-full px-3 py-2 border border-[#e0e0e3] rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#715a3e] focus:border-[#715a3e]" />
      </div>

      <button type="submit" disabled={isPending}
        className="px-6 py-2 text-sm bg-[#715a3e] text-white rounded-lg hover:bg-[#8b7355] disabled:opacity-50 font-medium">
        {isPending ? 'Saving...' : 'Save Settings'}
      </button>
    </form>
  )
}
