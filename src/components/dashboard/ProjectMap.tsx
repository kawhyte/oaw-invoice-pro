'use client'
import dynamic from 'next/dynamic'
import type { Project } from '@/types'

interface ProjectWithClient extends Project {
  clients: { name: string } | null
}

const MapClient = dynamic(
  () => import('./ProjectMapClient').then(m => m.ProjectMapClient),
  { ssr: false, loading: () => <div className="h-80 bg-gray-100 animate-pulse" /> }
)

export function ProjectMap({ projects }: { projects: ProjectWithClient[] }) {
  const hasCoords = projects.some(p => p.lat !== null && p.lng !== null)

  if (!hasCoords) {
    return (
      <div className="h-80 flex items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-400">No project locations added yet</p>
      </div>
    )
  }

  return <MapClient projects={projects} />
}
