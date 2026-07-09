'use client'
import { useRef, useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { saveFileMetaAction } from '@/app/(dashboard)/projects/[id]/actions'
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL, looksLikePdf } from '@/lib/uploadLimits'

interface Props { projectId: string; userId: string }

export function FileUpload({ projectId, userId }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    // Accept by MIME or extension — some mobile pickers report a blank type for real PDFs.
    if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) { setError('Only PDF files are allowed.'); return }
    if (file.size > MAX_UPLOAD_BYTES) { setError(`File too large (max ${MAX_UPLOAD_LABEL}).`); return }
    if (!(await looksLikePdf(file))) { setError('That file isn’t a valid PDF.'); return }
    setError(null)
    setUploading(true)
    try {
      const supabase = createClient()
      const storagePath = `${userId}/${projectId}/${Date.now()}-${file.name}`
      const { error: uploadError } = await supabase.storage.from('project-files').upload(storagePath, file)
      if (uploadError) throw uploadError
      startTransition(async () => {
        try {
          await saveFileMetaAction(projectId, file.name, storagePath, file.size)
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Upload failed.')
        }
      })
    } catch (err: any) {
      setError(err.message ?? 'Upload failed.')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const busy = uploading || isPending
  return (
    <div>
      <input ref={inputRef} type="file" accept="application/pdf" onChange={handleChange} className="hidden" id="file-upload" />
      <label htmlFor="file-upload"
        className={`inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors ${busy ? 'opacity-50 pointer-events-none' : ''}`}>
        {busy ? 'Uploading...' : '+ Upload Document'}
      </label>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}
