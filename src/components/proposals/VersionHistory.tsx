import { diffVersions, formatMoney } from '@/lib/proposals'
import type { ProposalResponse, ProposalVersion } from '@/types'

const when = (d: string) => new Date(d).toLocaleString('en-US', {
  month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Jamaica',
})

/** Sent versions (newest first) with what changed and the client's responses to each. */
export function VersionHistory({ versions, responses }: { versions: ProposalVersion[]; responses: ProposalResponse[] }) {
  if (versions.length === 0) {
    return <p className="text-sm text-gray-400">Not sent yet. Tap Send to share version 1 with your client.</p>
  }
  return (
    <ol className="space-y-4">
      {versions.map((v, idx) => {
        const prev = versions[idx + 1]
        const changes = prev ? diffVersions(prev.snapshot, v.snapshot) : []
        const replies = responses.filter(r => r.version === v.version)
        return (
          <li key={v.id} className="border-l-2 border-[#715a3e]/30 pl-4 min-w-0">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <p className="text-sm font-semibold text-[#1a1c1e]">Version {v.version}</p>
              <p className="text-sm data-mono text-[#1a1c1e]">{formatMoney(v.total, v.snapshot.currency)}</p>
            </div>
            <p className="text-xs text-[#8a8c94]">Sent {when(v.sent_at)}</p>
            {changes.length > 0 && (
              <ul className="mt-1.5 space-y-0.5 text-xs text-[#5a5c62] list-disc pl-4">
                {changes.map((c, i) => <li key={i} className="break-words">{c}</li>)}
              </ul>
            )}
            {replies.map(r => (
              <div key={r.id} className={`mt-2 rounded-lg px-3 py-2 text-sm ${r.kind === 'accept' ? 'bg-[#dde8dd] text-[#2a5130]' : 'bg-[#fdddb9]/60 text-[#584329]'}`}>
                <p className="font-medium">
                  {r.kind === 'accept' ? 'Accepted' : 'Asked for changes'}{r.responder_name ? ` — ${r.responder_name}` : ''}
                  <span className="font-normal text-xs opacity-80"> · {when(r.created_at)}</span>
                </p>
                {r.note && <p className="mt-0.5 whitespace-pre-wrap break-words">{r.note}</p>}
              </div>
            ))}
          </li>
        )
      })}
    </ol>
  )
}
