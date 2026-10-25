import { memo } from 'react'
import { getMessage } from '../lib/messages'

// Block sizes match LAYOUT in lib/messages.ts — the height estimate relies
// on them. The image is just a gradient so the demo doesn't depend on the network.
// In compact mode the timestamp line is hidden — every row becomes exactly
// LAYOUT.timeLine shorter.
export const MessageRow = memo(function MessageRow({ id, compact }: { id: number; compact: boolean }) {
  const message = getMessage(id)

  return (
    <div className={`flex px-4 py-1 ${message.isOwn ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[min(75%,520px)] rounded-2xl px-3 py-2 shadow-sm ${
          message.isOwn ? 'bg-sky-100' : 'bg-white'
        }`}
      >
        {!message.isOwn && <div className="h-4 text-xs leading-4 font-semibold text-sky-700">{message.author}</div>}
        {message.quote && (
          <div className="mt-1 h-4 truncate border-l-2 border-sky-400 pl-2 text-xs leading-4 text-slate-500">
            {message.quote}
          </div>
        )}
        {message.hasImage && (
          <div className="mt-1 h-44 w-64 max-w-full rounded-lg bg-linear-to-br from-sky-300 to-indigo-400" />
        )}
        <p className="text-sm leading-5 break-words whitespace-pre-wrap text-slate-800">{message.text}</p>
        {!compact && (
          <div className="text-right text-[10px] leading-3 text-slate-400">
            #{message.id} · {message.time}
          </div>
        )}
      </div>
    </div>
  )
})
