'use client'
import { useState } from 'react'
import { ProjectDialog } from '@/components/projects/ProjectDialog'
import { MarkCompleteButton } from '@/components/projects/MarkCompleteButton'
import type { Client, Project } from '@/types'

interface Props { project: Project; clients: Client[] }

export function ProjectDetailHeader({ project, clients }: Props) {
  const [showEdit, setShowEdit] = useState(false)
  return (
    <>
      <div className="flex items-center gap-2 shrink-0">
        <MarkCompleteButton projectId={project.id} status={project.status} />
        <button onClick={() => setShowEdit(true)}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shrink-0">
          Edit
        </button>
      </div>
      {showEdit && <ProjectDialog project={project} clients={clients} onClose={() => setShowEdit(false)} />}
    </>
  )
}
