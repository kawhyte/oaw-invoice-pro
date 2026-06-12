'use client'
import { useTransition } from 'react'
import { deleteFileAction } from '@/app/(dashboard)/projects/[id]/actions'
import type { ProjectFile } from '@/types'

interface FileWithUrl extends ProjectFile { signedUrl: string }
interface Props { projectId: string; files: FileWithUrl[] }

function formatBytes(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function FileList({ projectId, files }: Props) {
  const [isPending, startTransition] = useTransition()

  function handleDelete(fileId: string, storagePath: string) {
    if (!confirm('Delete this file?')) return
    startTransition(async () => { await deleteFileAction(fileId, storagePath, projectId) })
  }

  if (files.length === 0) return <p className="text-sm text-gray-400">No files uploaded yet.</p>

  return (
    <div className="space-y-2">
      {files.map(file => (
        <div key={file.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-red-500 shrink-0">📄</span>
            <div className="min-w-0">
              <a href={file.signedUrl} target="_blank" rel="noopener noreferrer"
                className="text-sm font-medium text-emerald-700 hover:text-emerald-800 truncate block">{file.name}</a>
              {file.size_bytes && <p className="text-xs text-gray-400">{formatBytes(file.size_bytes)}</p>}
            </div>
          </div>
          <button onClick={() => handleDelete(file.id, file.storage_path)} disabled={isPending}
            className="text-xs text-red-400 hover:text-red-600 shrink-0 ml-4 disabled:opacity-50">Delete</button>
        </div>
      ))}
    </div>
  )
}
