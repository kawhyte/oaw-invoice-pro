'use client'
import { useRef, useState, useTransition } from 'react'
import { renderWatermarkedPreviews } from '@/lib/pdfPreview'
import { createProposalDrawingUploadAction, saveProposalDrawingAction } from '@/app/(dashboard)/proposals/actions'
import { uploadToUrl } from '@/lib/uploadToUrl'
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL, looksLikePdf } from '@/lib/uploadLimits'

// Same on-device pipeline as DeliverableUpload: watermark every page here, then
// upload the original (never shown to the client) + preview/zoom JPEGs.
export function ProposalDrawingUpload({ proposalId, watermarkText }: { proposalId: string; watermarkText: string }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  async function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.type !== 'application/pdf' && !/\.pdf$/i.test(f.name)) { setError('Only PDF files are allowed.'); return }
    if (f.size > MAX_UPLOAD_BYTES) { setError(`File too large (max ${MAX_UPLOAD_LABEL}).`); return }
    if (!(await looksLikePdf(f))) { setError('That file isn’t a valid PDF.'); return }
    setError(null)
    setFile(f)
    setName(f.name.replace(/\.pdf$/i, ''))
  }

  function reset() {
    setFile(null); setName(''); setProgress(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  async function handleUpload() {
    if (!file) return
    setError(null)
    setBusy(true)
    try {
      setProgress('Preparing preview…')
      const { previews, zooms } = await renderWatermarkedPreviews(file, {
        watermarkText,
        onProgress: (done, total) => setProgress(`Preparing preview ${done}/${total}…`),
      })
      setProgress('Uploading original…')
      const plan = await createProposalDrawingUploadAction(
        proposalId, file.size, previews.map((p, i) => ({ previewSize: p.size, zoomSize: zooms[i].size })),
      )
      await uploadToUrl(plan.original.url, file, 'application/pdf')
      const previewPaths: string[] = []
      const zoomPaths: string[] = []
      for (let i = 0; i < plan.pages.length; i++) {
        setProgress(`Uploading page ${i + 1}/${plan.pages.length}…`)
        const pg = plan.pages[i]
        await uploadToUrl(pg.previewUrl, previews[i], 'image/jpeg')
        previewPaths.push(pg.previewPath)
        await uploadToUrl(pg.zoomUrl, zooms[i], 'image/jpeg')
        zoomPaths.push(pg.zoomPath)
      }
      setProgress('Saving…')
      const sizeBytes = file.size
      startTransition(async () => {
        try {
          await saveProposalDrawingAction(proposalId, {
            name: name.trim() || file.name, storagePath: plan.original.path,
            previewPaths, zoomPaths, pageCount: previews.length, sizeBytes,
          })
          reset()
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Upload failed.')
        }
      })
    } catch (err: unknown) {
      console.error('[proposal-drawing-upload]', err)
      const raw = String((err as Error)?.message ?? '')
      setError(/worker|pdf|invalid|module specifier/i.test(raw)
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
        <input ref={inputRef} type="file" accept="application/pdf" onChange={handlePick} className="hidden" id="proposal-drawing-upload" />
        <label htmlFor="proposal-drawing-upload"
          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
          + Add drawing
        </label>
        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      </div>
    )
  }

  return (
    <div className="w-full rounded-lg border border-[#e0e0e3] bg-[#f8f9fa] p-3 space-y-2">
      <p className="text-xs text-[#8a8c94] truncate">{file.name}</p>
      <input value={name} onChange={e => setName(e.target.value)} placeholder="Drawing name" disabled={working} maxLength={200}
        className="w-full px-3 py-2 border border-[#e0e0e3] rounded-lg text-sm bg-white focus:outline-none focus:border-[#715a3e] disabled:opacity-50" />
      <div className="flex items-center gap-2">
        <button onClick={handleUpload} disabled={working} className="btn-primary px-3 py-1.5 text-sm disabled:opacity-50">
          {working ? (progress ?? 'Working…') : 'Upload drawing'}
        </button>
        {!working && <button onClick={reset} className="text-sm text-[#8a8c94] hover:text-[#5a5c62]">Cancel</button>}
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
