'use client'
import { useState } from 'react'
import { ProjectDialog } from '@/components/projects/ProjectDialog'
import type { Client, Project } from '@/types'

interface Props { project: Project; clients: Client[] }

export function ProjectDetailHeader({ project, clients }: Props) {
  const [showEdit, setShowEdit] = useState(false)
  return (
    <>
      <button onClick={() => setShowEdit(true)}
        className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shrink-0">
        Edit
      </button>
      {showEdit && <ProjectDialog project={project} clients={clients} onClose={() => setShowEdit(false)} />}
    </>
  )
}
