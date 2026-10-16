import { imageResultsFromMeta, imageResultsFromPtcDispatch } from '../image-result-node.js'
import { pushTlLandingsLive } from './tl-canvas-bridge.js'

interface EventEntry {
  readonly type: string
  readonly event: { readonly type: string; readonly seq: number; readonly data: Record<string, unknown> }
}

interface EventSource {
  getSnapshot(): {
    readonly entries: readonly EventEntry[]
    readonly change: { readonly kind: string; readonly entries?: readonly EventEntry[] }
  }
  subscribe(listener: () => void): () => void
}

/** Small runtime face: older hosts may not expose the modern session feed. */
export interface CanvasSessions {
  list: {
    getSnapshot(): { current?: string | undefined }
    subscribe(listener: () => void): () => void
  }
  binding(id: string): { eventSource: EventSource } | undefined
}

/** Subscribe to live additions, never to card rendering or history replay. */
export function startConversationLandings(sessions: CanvasSessions): () => void {
  let source: EventSource | undefined
  let stopEvents: (() => void) | undefined
  const followCurrent = (): void => {
    const id = sessions.list.getSnapshot().current
    const next = id === undefined ? undefined : sessions.binding(id)?.eventSource
    if (next === source) return
    stopEvents?.()
    source = next
    if (next === undefined) return
    let lastSeq = next.getSnapshot().entries.reduce((seq, entry) => Math.max(seq, entry.event.seq), -1)
    stopEvents = next.subscribe(() => {
      const change = next.getSnapshot().change
      for (const entry of change.entries ?? []) {
        if (entry.type !== 'event') continue
        const { event } = entry
        const isNew = event.seq > lastSeq
        lastSeq = Math.max(lastSeq, event.seq)
        if (change.kind !== 'append' || !isNew) continue
        const results = event.type === 'tool/result'
          ? imageResultsFromMeta(event.data.meta) : imageResultsFromPtcDispatch(event)
        if (results.length === 0) continue
        pushTlLandingsLive(results.map(result => ({
          galleryId: String(result.attachment.attachmentId),
          attachment: result.attachment,
          fromConversation: true,
          prompt: result.prompt,
          provider: result.provider,
          model: result.model,
        })))
      }
    })
  }
  const stopList = sessions.list.subscribe(followCurrent)
  followCurrent()
  return () => { stopList(); stopEvents?.() }
}
