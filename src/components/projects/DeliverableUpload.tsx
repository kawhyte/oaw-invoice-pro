'use client'
import { useRef, useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { renderWatermarkedPreviews } from '@/lib/pdfPreview'
import { saveDeliverableAction } from '@/app/(dashboard)/projects/[id]/actions'
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL, looksLikePdf } from '@/lib/uploadLimits'

interface InvoiceOption { id: string; invoice_number: string; status: string }
interface Props {
  projectId: string
  userId: string
  invoices: InvoiceOption[]
  watermarkText: string
}

export function DeliverableUpload({ projectId, userId, invoices, watermarkText }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState('')
  const [invoiceId, setInvoiceId] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  async function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    // Accept by MIME or extension — some mobile pickers report a blank type for real PDFs.
    if (f.type !== 'application/pdf' && !/\.pdf$/i.test(f.name)) { setError('Only PDF files are allowed.'); return }
    if (f.size > MAX_UPLOAD_BYTES) { setError(`File too large (max ${MAX_UPLOAD_LABEL}).`); return }
    if (!(await looksLikePdf(f))) { setError('That file isn’t a valid PDF.'); return }
    setError(null)
    setFile(f)
    setName(f.name.replace(/\.pdf$/i, ''))
  }

  function reset() {
    setFile(null); setName(''); setInvoiceId(''); setProgress(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  async function handleUpload() {
    if (!file) return
    setError(null)
    setBusy(true)
    try {
      const supabase = createClient()
      const id = crypto.randomUUID()
      const base = `${userId}/${projectId}/deliverables/${id}`

      // 1. Rasterize watermarked previews (inline + on-demand zoom) on this device.
      setProgress('Preparing preview…')
      const { previews, zooms } = await renderWatermarkedPreviews(file, {
        watermarkText,
        onProgress: (done, total) => setProgress(`Preparing preview ${done}/${total}…`),
      })

      // 2. Upload the original print-ready PDF (stays gated).
      setProgress('Uploading original…')
      const originalPath = `${base}/original.pdf`
      const { error: origErr } = await supabase.storage
        .from('project-files')
        .upload(originalPath, file, { contentType: 'application/pdf' })
      if (origErr) throw origErr

      // 3. Upload each preview page + its high-res zoom companion.
      const previewPaths: string[] = []
      const zoomPaths: string[] = []
      for (let i = 0; i < previews.length; i++) {
        setProgress(`Uploading page ${i + 1}/${previews.length}…`)
        const previewPath = `${base}/page-${i + 1}.jpg`
        const { error: pErr } = await supabase.storage
          .from('project-files')
          .upload(previewPath, previews[i], { contentType: 'image/jpeg' })
        if (pErr) throw pErr
        previewPaths.push(previewPath)

        const zoomPath = `${base}/page-${i + 1}@zoom.jpg`
        const { error: zErr } = await supabase.storage
          .from('project-files')
          .upload(zoomPath, zooms[i], { contentType: 'image/jpeg' })
        if (zErr) throw zErr
        zoomPaths.push(zoomPath)
      }

      // 4. Save metadata.
      setProgress('Saving…')
      const sizeBytes = file.size
      startTransition(async () => {
        await saveDeliverableAction(projectId, {
          name: name.trim() || file.name,
          storagePath: originalPath,
          previewPaths,
          zoomPaths,
          pageCount: previews.length,
          sizeBytes,
          linkedInvoiceId: invoiceId || null,
        })
        reset()
      })
    } catch (err: any) {
      // Preview rasterization (pdf.js) can surface cryptic internal errors;
      // show something a non-technical user can act on, but keep the detail
      // in the console for debugging.
      console.error('[deliverable-upload]', err)
      const raw = String(err?.message ?? '')
      const isRenderIssue = /worker|pdf|invalid|module specifier/i.test(raw)
      setError(isRenderIssue
        ? "Couldn't process this PDF. Please try again or use a different file."
        : (raw || 'Upload failed.'))
    } finally {
      setBusy(false)
    }
  }

  const working = busy || isPending

  if (!file) {
    return (
      <div>
        <input ref={inputRef} type="file" accept="application/pdf" onChange={handlePick} className="hidden" id="deliverable-upload" />
        <label htmlFor="deliverable-upload"
          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
          + Add drawing
        </label>
        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      </div>
    )
  }

  return (
    <div className="w-full sm:w-auto rounded-lg border border-[#e0e0e3] bg-[#f8f9fa] p-3 space-y-2">
      <p className="text-xs text-[#8a8c94] truncate">{file.name}</p>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Drawing name"
          disabled={working}
          className="flex-1 px-3 py-2 border border-[#e0e0e3] rounded-lg text-sm bg-white focus:outline-none focus:border-[#715a3e] disabled:opacity-50"
        />
        <select
          value={invoiceId}
          onChange={e => setInvoiceId(e.target.value)}
          disabled={working}
          className="select-field px-3 py-2 border border-[#e0e0e3] rounded-lg text-sm bg-white focus:outline-none focus:border-[#715a3e] disabled:opacity-50"
        >
          <option value="">No invoice link (manual unlock)</option>
          {invoices.map(inv => (
            <option key={inv.id} value={inv.id}>Unlock when {inv.invoice_number} is paid</option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={handleUpload} disabled={working}
          className="btn-primary px-3 py-1.5 text-sm disabled:opacity-50">
          {working ? (progress ?? 'Working…') : 'Upload drawing'}
        </button>
        {!working && (
          <button onClick={reset} className="text-sm text-[#8a8c94] hover:text-[#5a5c62]">Cancel</button>
        )}
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
