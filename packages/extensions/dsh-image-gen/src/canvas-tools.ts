/**
 * Model-facing tools over the mirrored workbench canvas state.
 *
 * `canvas_state` answers "what is on the canvas right now" with a compact
 * inventory; `view_canvas` returns the latest selection screenshot as a real
 * image block so the model can look at hand-drawn sketches and annotated
 * selections the way it looks at any conversation image. Both tools stay
 * registered when no canvas is connected — their answers then tell the model
 * to ask the user to open the workbench instead of failing silently.
 */
import type { Context } from '@deepseek-ai/cordis'
import type { ImageAttachmentRef, StoredImageAttachment } from '@deepseek-ai/dsh-attachment'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { CanvasMirror, CanvasMirrorEntry, CanvasSelectionImage } from './canvas-state.js'
import { findReferenceImages } from './reference-image.js'
import type { ReferenceImageAgent, ResolvedReferenceImage } from './reference-image.js'

/** The small attachment surface the canvas-selection resolver needs. */
export type CanvasSelectionImageStore = {
  readImage(ref: ImageAttachmentRef, signal?: AbortSignal): Promise<StoredImageAttachment>
}

/** Dependencies of the canvas tools beyond the mirror itself. */
export interface CanvasToolsDeps {
  /**
   * Materializes an in-memory selection screenshot as a durable attachment.
   * Called by view_canvas only, at the moment the image actually enters the
   * conversation — the durable store is content-addressed, so repeated views
   * of the same bytes reuse one object and dead screenshots never persist.
   */
  persistSelectionImage(image: CanvasSelectionImage): Promise<ImageAttachmentRef>
}

/** Register the canvas tools on a context that owns a canvas mirror. */
export function registerCanvasTools(ctx: Context, mirror: CanvasMirror, deps: CanvasToolsDeps): void {
  ctx.tools.register(defineTool({
    name: 'canvas_state',
    description: 'Inspect the current state of the image-gen workbench infinite canvas: what shapes are on it (generated images, hand-drawn strokes, text notes) and what is currently selected. Use whenever the user refers to "the canvas", something they drew or placed there, or a selection, and before view_canvas or edit_image with source=canvas_selection.',
    parameters: {},
    output: {
      schema: {
        type: 'object', additionalProperties: false, properties: {
          digest: { type: 'string', required: true },
          connected: { type: 'boolean', required: true },
          nodeCount: { type: 'integer', required: true },
          selectionCount: { type: 'integer', required: true },
          hasSelectionImage: { type: 'boolean', required: true },
        },
      },
      render: (_args: unknown, value: CanvasStateValue) => [{ type: 'text' as const, text: value.digest }],
    },
    async execute(): Promise<CanvasStateValue> {
      const entry = mirror.latest()
      return {
        digest: mirror.digest(),
        connected: entry !== undefined,
        nodeCount: entry?.nodeCount ?? 0,
        selectionCount: entry?.selectionCount ?? 0,
        hasSelectionImage: mirror.latestSelectionImage() !== undefined,
      }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'view_canvas',
    description: 'View the current selection on the image-gen workbench infinite canvas as an image (a screenshot the canvas pushed for its selection: hand-drawn sketches, annotated images, or any selected shapes). Call it after canvas_state confirms a selection exists. When nothing is selected, ask the user to select the shapes first. The image becomes part of the conversation, so you can reason about it directly.',
    parameters: {},
    output: {
      schema: {
        type: 'object', additionalProperties: false, properties: {
          digest: { type: 'string', required: true },
          attachment: { type: 'object', additionalProperties: false, properties: {
            attachmentId: { type: 'string', required: true }, mediaType: { type: 'string', required: true }, bytes: { type: 'integer', required: true }, width: { type: 'integer', required: true }, height: { type: 'integer', required: true }, name: { type: 'string' },
          } },
        },
      },
      render: (_args: unknown, value: ViewCanvasValue) => {
        if (value.attachment === undefined) {
          return [{ type: 'text' as const, text: value.digest }]
        }
        return [
          { type: 'text' as const, text: `${value.digest}\nThe screenshot of the current canvas selection is attached below. Respond to the user without calling read or other tools to locate it.` },
          { type: 'image' as const, attachment: value.attachment },
        ]
      },
    },
    async execute(): Promise<ViewCanvasValue> {
      const image = mirror.latestSelectionImage()
      // This is the materialization moment: only a screenshot the model
      // actually views becomes a durable attachment. Everything the canvas
      // pushed but nobody looked at stays memory-only and dies with the
      // selection or the canvas itself.
      const attachment = image === undefined ? undefined : await deps.persistSelectionImage(image)
      return {
        digest: mirror.digest(),
        ...(attachment === undefined ? {} : { attachment: attachmentMeta(attachment) }),
      }
    },
  }))
}

interface CanvasStateValue {
  digest: string
  connected: boolean
  nodeCount: number
  selectionCount: number
  hasSelectionImage: boolean
}

interface ViewCanvasValue {
  digest: string
  attachment?: ImageAttachmentRef
}

function attachmentMeta(ref: ImageAttachmentRef): ImageAttachmentRef {
  return {
    attachmentId: ref.attachmentId,
    mediaType: ref.mediaType,
    bytes: ref.bytes,
    width: ref.width,
    height: ref.height,
    ...(ref.name === undefined ? {} : { name: ref.name }),
  }
}

/**
 * Resolve the mirrored canvas selection as an edit reference image for
 * edit_image's `canvas_selection` source. The screenshot comes straight from
 * the mirror's in-memory bytes — identical to what view_canvas shows the
 * model — and is never persisted here: reference images go to the image
 * provider, not the conversation.
 */
export async function resolveCanvasSelectionReferences(input: {
  mirror: CanvasMirror
  attachments: CanvasSelectionImageStore
  agent?: ReferenceImageAgent
  maxBytes?: number
  signal: AbortSignal
}): Promise<ResolvedReferenceImage[]> {
  const entry = input.mirror.latest()
  if (entry === undefined) {
    throw new Error('The image-gen workbench canvas is not connected. Ask the user to open the image-gen workbench (gallery tab or right-sidebar studio tab), switch to the infinite canvas view, and select the shapes to edit.')
  }
  if (entry.selectionCount === 0) {
    throw new Error('The image-gen workbench canvas has no selection to use as a reference image. Ask the user to select the shapes (for example their sketch) on the infinite canvas, then retry.')
  }

  if (entry.selectionStatus === 'preparing') throw new Error('Canvas selection is still preparing. Wait for the canvas status bar to report ready, then retry.')

  // Ordered attachment ids of conversation-generated images in the selection.
  const attachmentIds: string[] = []
  for (const item of entry.selectionItems) {
    if (item.kind !== 'image' || typeof item.attachmentId !== 'string' || item.attachmentId.length === 0) continue
    attachmentIds.push(item.attachmentId)
  }
  const fullCoverage = entry.selectionItems.length === entry.selectionCount

  // Prefer complete refs synchronized from canvas assets. Older clients still
  // resolve attachment ids through conversation history.
  const originals: ResolvedReferenceImage[] = []
  const conversationRefs = input.agent === undefined || attachmentIds.length === 0
    ? [] : findReferenceImages(input.agent.session.deriveMessages(), attachmentIds)
  for (const item of entry.selectionItems) {
    if (item.kind !== 'image') continue
    const ref = item.attachment ?? conversationRefs.find(candidate => candidate.attachmentId === item.attachmentId)
    if (ref !== undefined) {
      const stored = await input.attachments.readImage(ref, input.signal)
      if (input.maxBytes !== undefined && stored.data.byteLength > input.maxBytes) {
        throw new Error(`edit_image canvas selection image is too large (${stored.data.byteLength} bytes; maximum ${input.maxBytes})`)
      }
      originals.push({ data: stored.data, mediaType: stored.ref.mediaType })
    }
  }

  // Every selected shape is a conversation image we resolved: originals only,
  // so nothing gets downscaled through the screenshot composite.
  if (
    originals.length > 0
    && fullCoverage
    && entry.selectionItems.every(item => item.kind === 'image')
    && originals.length === entry.selectionCount
  ) {
    return originals
  }

  if (entry.selectionError !== undefined) throw new Error(`Canvas selection synchronization failed: ${entry.selectionError}. Retry from the canvas status bar; no selected references were omitted.`)

  const screenshot = readSelectionScreenshot(entry, input)
  if (screenshot !== undefined) return [...originals, screenshot]
  throw new Error('The image-gen workbench canvas selection has no usable reference image yet. Ask the user to keep the shapes selected for a moment longer (the canvas pushes a screenshot about a second after the selection settles), then retry.')
}

/** The mirrored selection screenshot bytes, or undefined when none was pushed. */
function readSelectionScreenshot(entry: CanvasMirrorEntry, input: {
  maxBytes?: number
}): ResolvedReferenceImage | undefined {
  const image = entry.selectionImage
  if (image === undefined) return undefined
  if (input.maxBytes !== undefined && image.data.byteLength > input.maxBytes) {
    throw new Error(`edit_image canvas selection screenshot is too large (${image.data.byteLength} bytes; maximum ${input.maxBytes})`)
  }
  return { data: image.data, mediaType: image.mediaType }
}
