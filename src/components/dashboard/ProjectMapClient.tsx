'use client'
import { useEffect, useRef } from 'react'
import type { Project } from '@/types'

const STATUS_COLORS: Record<string, string> = {
  discovery: '#9ca3af',
  in_progress: '#3b82f6',
  review: '#f59e0b',
  complete: '#22c55e',
}
const STATUS_LABELS: Record<string, string> = {
  discovery: 'Discovery',
  in_progress: 'In Progress',
  review: 'Review',
  complete: 'Complete',
}

interface ProjectWithClient extends Project {
  clients: { name: string } | null
}

export function ProjectMapClient({ projects }: { projects: ProjectWithClient[] }) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<any>(null)

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return
    const valid = projects.filter(p => p.lat !== null && p.lng !== null)

    import('leaflet').then(({ default: L }) => {
      if (!mapRef.current || mapInstance.current) return

      const map = L.map(mapRef.current).setView([18.1096, -77.2975], 8)
      mapInstance.current = map

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map)

      valid.forEach(p => {
        const color = STATUS_COLORS[p.status] ?? '#9ca3af'
        const icon = L.divIcon({
          html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>`,
          className: '',
          iconAnchor: [7, 7],
          popupAnchor: [0, -10],
        })
        L.marker([p.lat!, p.lng!], { icon })
          .addTo(map)
          .bindPopup(`
            <div style="font-family:system-ui;font-size:13px;min-width:150px;padding:2px 0">
              <p style="font-weight:600;margin:0 0 2px">${p.title}</p>
              <p style="color:#6b7280;margin:0 0 6px;font-size:12px">${p.clients?.name ?? ''}</p>
              <span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;background:${color}22;color:${color};font-weight:500">
                ${STATUS_LABELS[p.status] ?? p.status}
              </span>
            </div>
          `)
      })

      if (valid.length > 1) {
        map.fitBounds(L.latLngBounds(valid.map(p => [p.lat!, p.lng!])), { padding: [40, 40] })
      } else if (valid.length === 1) {
        map.setView([valid[0].lat!, valid[0].lng!], 11)
      }
    })

    return () => {
      mapInstance.current?.remove()
      mapInstance.current = null
    }
  }, [projects])

  return <div ref={mapRef} className="h-80 w-full" />
}
