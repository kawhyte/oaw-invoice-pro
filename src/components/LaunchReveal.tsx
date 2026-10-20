'use client'
import { useEffect, useState } from 'react'
import { LaunchMark } from '@/components/LaunchMark'

const READY = 'ow:page-ready'
declare global { interface Window { __owPageReady?: boolean } }

// Rendered inside the dashboard page: mounts only once the real content (not
// the loading skeleton) is on screen, and tells LaunchReveal to start fading.
export function LaunchReady() {
  useEffect(() => {
    window.__owPageReady = true
    window.dispatchEvent(new Event(READY))
  }, [])
  return null
}

// After the launch screen hands over (LaunchRedirect sets the ow_launch
// cookie; the dashboard layout reads it and passes `active`), this keeps the same dark screen over the dashboard until its
// content is in (LaunchReady, or 2.5s at most), then fades it out, so opening
// the app dissolves straight into the finished page: no cut to white and no
// skeleton showing through. Renders nothing on any other navigation.
export function LaunchReveal({ active }: { active: boolean }) {
  const [phase, setPhase] = useState<'off' | 'hold' | 'fade'>(active ? 'hold' : 'off')

  useEffect(() => {
    if (active) document.cookie = 'ow_launch=; path=/; max-age=0'
  }, [active])

  useEffect(() => {
    if (phase !== 'hold') return
    const go = () => setPhase('fade')
    if (window.__owPageReady) { go(); return }
    window.addEventListener(READY, go, { once: true })
    const t = setTimeout(go, 2500)
    return () => { window.removeEventListener(READY, go); clearTimeout(t) }
  }, [phase])

  if (phase === 'off') return null
  return (
    <div
      aria-hidden
      onAnimationEnd={(e) => { if (e.target === e.currentTarget) setPhase('off') }}
      className={`${phase === 'fade' ? 'launch-reveal ' : ''}fixed inset-0 z-[60] grid place-items-center bg-[#1a1c1e] pointer-events-none`}
    >
      <LaunchMark animated={false} />
    </div>
  )
}
