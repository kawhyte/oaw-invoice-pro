'use client'
import { createContext, useCallback, useContext, useRef, useState } from 'react'

interface ConfirmOptions {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'default'
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

/**
 * App-wide themed replacement for the native window.confirm(). Provides an
 * imperative `useConfirm()` hook that returns a promise resolving true/false,
 * so call sites keep the familiar `if (!(await confirm(...))) return` flow.
 * The dialog renders at the root (z-[100]) so it overlays everything — even
 * other open modals — just like the native confirm did.
 */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ConfirmOptions | null>(null)
  const resolver = useRef<((v: boolean) => void) | null>(null)

  const confirm = useCallback<ConfirmFn>((opts) => {
    setState(opts)
    return new Promise<boolean>((resolve) => { resolver.current = resolve })
  }, [])

  const close = useCallback((result: boolean) => {
    resolver.current?.(result)
    resolver.current = null
    setState(null)
  }, [])

  const isDanger = state?.variant !== 'default' // default to danger styling

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={() => close(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isDanger ? 'bg-[#ffdad6]' : 'bg-[#f5ede4]'}`}>
                <svg className={`w-5 h-5 ${isDanger ? 'text-[#93000a]' : 'text-[#715a3e]'}`} fill="none" viewBox="0 0 24 24"
                  stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-[#1a1c1e] text-sm">{state.title}</h3>
                {state.description && (
                  <p className="text-xs text-[#5a5c62] mt-1 leading-relaxed">{state.description}</p>
                )}
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => close(false)}
                className="px-4 py-2 text-sm font-medium text-[#1a1c1e] border border-[#e0e0e3] rounded-lg hover:bg-[#f8f9fa] transition-colors"
              >
                {state.cancelLabel ?? 'Cancel'}
              </button>
              <button
                onClick={() => close(true)}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${isDanger ? 'bg-[#93000a] hover:bg-[#b91c1c]' : 'bg-[#715a3e] hover:bg-[#8b7355]'}`}
              >
                {state.confirmLabel ?? 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used within a ConfirmProvider')
  return ctx
}
