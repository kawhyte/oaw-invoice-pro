'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ClientDialog } from './ClientDialog'
import type { Client } from '@/types'

export function EditClientButton({ client }: { client: Client }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-3 py-1.5 text-sm border border-[#e0e0e3] text-[#1a1c1e] rounded-lg hover:bg-[#f8f9fa] transition-colors"
      >
        Edit
      </button>
      {open && (
        <ClientDialog
          client={client}
          onClose={() => {
            setOpen(false)
            // Re-fetch the server component so edits show (and a delete 404s).
            router.refresh()
          }}
        />
      )}
    </>
  )
}
