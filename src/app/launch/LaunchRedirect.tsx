'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

// Moves from the launch screen into the app. A client-side replace keeps the
// animated splash on screen until the dashboard is ready to show (its loading
// skeleton or content), so there's no blank frame in between.
export function LaunchRedirect() {
  const router = useRouter()
  const [slow, setSlow] = useState(false)

  useEffect(() => {
    // Tells the dashboard's LaunchReveal to fade this screen out over it.
    document.documentElement.dataset.launch = '1'
    window.__owPageReady = false
    router.prefetch('/dashboard')
    router.replace('/dashboard')
    const t = setTimeout(() => setSlow(true), 12000)
    return () => clearTimeout(t)
  }, [router])

  if (!slow) return null
  return (
    <div className="absolute bottom-16 inset-x-0 flex flex-col items-center gap-2 launch-fade">
      <p className="text-xs text-[#f5ede4]/60">Still loading — check your connection.</p>
      <button
        type="button"
        onClick={() => location.replace('/dashboard')}
        className="px-4 py-1.5 rounded-full border border-[#a88763]/60 text-xs text-[#f5ede4] hover:bg-[#a88763]/20"
      >
        Try again
      </button>
    </div>
  )
}
