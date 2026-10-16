/** Selected originals are uploaded individually; previews stay memory-only. */
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { ImageAttachmentRef, ImageMediaType } from '@deepseek-ai/dsh-attachment'

export interface CanvasAssetRouteDeps {
  maxImageBytes: number
  /** Host validates image contents/dimensions and content-addresses the bytes. */
  saveImage(image: { data: Uint8Array; mediaType: ImageMediaType }): Promise<ImageAttachmentRef>
}

export async function serveCanvasAsset(req: IncomingMessage, res: ServerResponse, deps: CanvasAssetRouteDeps): Promise<void> {
  const reply = (status: number, body: unknown): void => {
    res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' })
    res.end(JSON.stringify(body))
  }
  const { origin, host } = req.headers
  if (origin !== undefined && host !== undefined && origin !== `http://${host}` && origin !== `https://${host}`) return reply(403, { error: 'origin-rejected' })
  if (req.method === 'GET') return reply(200, { maxImageBytes: deps.maxImageBytes })
  if (req.method !== 'POST') return reply(405, { error: 'method-not-allowed' })
  const mediaType = req.headers['content-type']?.split(';')[0]?.trim()
  if (mediaType !== 'image/png' && mediaType !== 'image/jpeg' && mediaType !== 'image/webp' && mediaType !== 'image/gif') return reply(415, { error: 'unsupported-image-type' })
  try {
    const chunks: Buffer[] = []
    let bytes = 0
    for await (const chunk of req) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      bytes += buffer.byteLength
      if (bytes > deps.maxImageBytes) return reply(413, { error: 'original-image-too-large' })
      chunks.push(buffer)
    }
    if (bytes === 0) return reply(400, { error: 'empty-image' })
    const attachment = await deps.saveImage({ data: Buffer.concat(chunks), mediaType })
    reply(200, { attachment })
  } catch {
    reply(400, { error: 'canvas-original-unavailable' })
  }
}
