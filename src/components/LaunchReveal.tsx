'use client'
import { useEffect, useState } from 'react'
import { LaunchMark } from '@/components/LaunchMark'

// After the launch screen hands over (LaunchRedirect sets data-launch on
// <html>), this repaints the same dark screen on top of the dashboard and
// fades it out, so opening the app dissolves into the page instead of
// cutting from dark to white. Renders nothing on any other navigation.
export function LaunchReveal() {
  const [show, setShow] = useState(
    () => typeof document !== 'undefined' && document.documentElement.dataset.launch === '1',
  )
  useEffect(() => { delete document.documentElement.dataset.launch }, [])
  if (!show) return null
  return (
    <div
      aria-hidden
      onAnimationEnd={(e) => { if (e.target === e.currentTarget) setShow(false) }}
      className="launch-reveal fixed inset-0 z-[60] grid place-items-center bg-[#1a1c1e] pointer-events-none"
    >
      <LaunchMark animated={false} />
    </div>
  )
}
