import { useState } from 'react'
import { CopyIcon, ShareIcon } from './icons'
import { Button } from './ui'

/** Toont een link met kopiëren en (waar beschikbaar) het deelmenu van het apparaat. */
export function ShareLink({ url, title, text }: { url: string; title: string; text: string }) {
  const [copied, setCopied] = useState(false)
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-surface p-4">
      <label className="flex flex-col gap-2">
        <span className="text-[13px] font-semibold text-ink-3">Link</span>
        <input
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="min-h-11 rounded-xl border border-line bg-ground px-3 font-mono text-[13px] text-ink"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          onClick={async () => {
            await navigator.clipboard.writeText(url)
            setCopied(true)
          }}
        >
          <CopyIcon size={18} />
          {copied ? 'Gekopieerd' : 'Kopiëren'}
        </Button>
        {canShare && (
          <Button variant="secondary" onClick={() => navigator.share({ title, text, url }).catch(() => {})}>
            <ShareIcon size={18} />
            Delen
          </Button>
        )}
      </div>
    </div>
  )
}
