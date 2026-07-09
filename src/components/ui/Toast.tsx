'use client'
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'

type ToastVariant = 'error' | 'success'
interface ToastItem { id: number; message: string; variant: ToastVariant }

interface ToastFns {
  error: (message: string) => void
  success: (message: string) => void
}

const ToastContext = createContext<ToastFns | null>(null)

/**
 * App-wide toast notifications, following the ConfirmProvider pattern
 * (src/components/ui/ConfirmDialog.tsx): a context provider rendering at the
 * root with a high z-index. Toasts auto-dismiss after 5s and can be tapped to
 * dismiss. Positioned bottom-center above the mobile bottom nav (MobileNav is
 * z-20 fixed bottom; toasts sit at bottom-20 on mobile, bottom-6 on lg).
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(0)

  const push = useCallback((message: string, variant: ToastVariant) => {
    const id = nextId.current++
    setToasts((t) => [...t, { id, message, variant }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000)
  }, [])

  const fns = useMemo<ToastFns>(() => ({
    error: (m) => push(m, 'error'),
    success: (m) => push(m, 'success'),
  }), [push])

  return (
    <ToastContext.Provider value={fns}>
      {children}
      {toasts.length > 0 && (
        <div className="fixed inset-x-0 bottom-20 lg:bottom-6 z-[110] flex flex-col items-center gap-2 px-4 pointer-events-none">
          {toasts.map((t) => (
            <button
              key={t.id}
              onClick={() => setToasts((all) => all.filter((x) => x.id !== t.id))}
              className={`pointer-events-auto max-w-sm w-full text-left rounded-xl shadow-2xl px-4 py-3 text-sm text-white ${
                t.variant === 'error' ? 'bg-[#93000a]' : 'bg-[#1a1c1e]'
              }`}
            >
              {t.message}
            </button>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  )
}

export function useToast(): ToastFns {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within a ToastProvider')
  return ctx
}

/**
 * Normalize a caught value into a user-facing message, re-throwing Next.js
 * redirect "errors" (redirect() inside a server action throws an object whose
 * digest starts with NEXT_REDIRECT — it is control flow, not a failure).
 */
export function toErrorMessage(err: unknown): string {
  if (
    typeof err === 'object' && err !== null && 'digest' in err &&
    String((err as { digest?: unknown }).digest).startsWith('NEXT_REDIRECT')
  ) {
    throw err
  }
  if (err instanceof Error && err.message) return err.message
  if (typeof err === 'string' && err) return err
  return 'Something went wrong. Please try again.'
}
