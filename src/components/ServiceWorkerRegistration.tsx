'use client'
import { useEffect, useState } from 'react'

/**
 * Registers the service worker and shows a refresh banner when a new build's
 * worker is waiting. Self-contained banner (not the dashboard ToastProvider)
 * because this mounts in the ROOT layout, outside the dashboard providers.
 */
export function ServiceWorkerRegistration() {
  const [updateReady, setUpdateReady] = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        if (reg.waiting) setUpdateReady(true)
        reg.addEventListener('updatefound', () => {
          const sw = reg.installing
          if (!sw) return
          sw.addEventListener('statechange', () => {
            // "installed" with an existing controller = an update is waiting
            // (first-ever install has no controller — no banner then).
            if (sw.state === 'installed' && navigator.serviceWorker.controller) {
              setUpdateReady(true)
            }
          })
        })
      })
      .catch(() => {})
  }, [])

  if (!updateReady) return null
  return (
    <div className="fixed inset-x-0 bottom-20 lg:bottom-6 z-[120] flex justify-center px-4">
      <button
        onClick={() => window.location.reload()}
        className="rounded-xl bg-[#1a1c1e] text-white text-sm px-4 py-3 shadow-2xl hover:bg-black transition-colors"
      >
        A new version is available — tap to refresh
      </button>
    </div>
  )
}
