'use client'
import { useTransition } from 'react'
import { deleteFileAction, toggleFileVisibilityAction } from '@/app/(dashboard)/projects/[id]/actions'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import type { ProjectFile } from '@/types'

interface FileWithUrl extends ProjectFile { signedUrl: string }
interface Props { projectId: string; files: FileWithUrl[]; showVisibility?: boolean }

function formatBytes(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function FileList({ projectId, files, showVisibility = true }: Props) {
  const [isPending, startTransition] = useTransition()
  const confirm = useConfirm()

  async function handleDelete(fileId: string, storagePath: string) {
    if (!(await confirm({ title: 'Delete this file?', description: 'This removes the file from the project and the client’s shared view.', confirmLabel: 'Delete', variant: 'danger' }))) return
    startTransition(async () => { await deleteFileAction(fileId, storagePath, projectId) })
  }

  function handleToggle(fileId: string, current: boolean) {
    startTransition(async () => { await toggleFileVisibilityAction(fileId, projectId, current) })
  }

  if (files.length === 0) return <p className="text-sm text-gray-400">No files uploaded yet.</p>

  return (
    <div className="space-y-2">
      {files.map(file => (
        <div key={file.id} className="flex flex-col gap-2 py-2 border-b border-gray-50 last:border-0 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-red-500 shrink-0">📄</span>
            <div className="min-w-0">
              <a href={file.signedUrl} target="_blank" rel="noopener noreferrer"
                className="text-sm font-medium text-[#715a3e] hover:text-[#8b7355] truncate block">{file.name}</a>
              <p className="text-xs text-gray-400">
                {formatBytes(file.size_bytes)}
                {showVisibility && (file.is_client_visible
                  ? ''
                  : `${file.size_bytes ? ' · ' : ''}Private — not on client link`)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 shrink-0 pl-7 sm:pl-0">
            {showVisibility && (
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <span className="text-xs text-[#5a5c62]">Visible to client</span>
                <button type="button" role="switch" aria-checked={file.is_client_visible}
                  onClick={() => handleToggle(file.id, file.is_client_visible)} disabled={isPending}
                  className={`relative w-9 h-5 rounded-full transition-colors disabled:opacity-50 ${file.is_client_visible ? 'bg-[#715a3e]' : 'bg-gray-300'}`}>
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${file.is_client_visible ? 'translate-x-4' : ''}`} />
                </button>
              </label>
            )}
            <button onClick={() => handleDelete(file.id, file.storage_path)} disabled={isPending}
              className="text-xs text-red-400 hover:text-red-600 disabled:opacity-50">Delete</button>
          </div>
        </div>
      ))}
    </div>
  )
}
