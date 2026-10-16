/** Process-local asynchronous workbench jobs. */
import { randomUUID } from 'node:crypto'
import type {
  StudioGenerateRequest,
  StudioGenerateResponse,
  StudioJobStartResponse,
  StudioJobStatusResponse,
} from './shared.js'
import { redactSecrets } from './redact.js'

const JOB_TTL_MS = 30 * 60 * 1000
const MAX_RETAINED_JOBS = 100
const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000

interface JobRecord extends StudioJobStatusResponse {
  controller: AbortController
  timeout?: ReturnType<typeof setTimeout>
}

export type StudioJobRunner = (input: StudioGenerateRequest, signal: AbortSignal) => Promise<StudioGenerateResponse>

/**
 * Owns the browser workbench's async lifecycle. Results are retained briefly
 * so a browser reconnect can collect a completed attachment without keeping an
 * upstream request or a response socket open.
 */
export class StudioJobStore {
  private readonly jobs = new Map<string, JobRecord>()

  constructor(private readonly timeoutMs = DEFAULT_TIMEOUT_MS) {}

  start(input: StudioGenerateRequest, run: StudioJobRunner): StudioJobStartResponse {
    this.prune()
    const createdAt = Date.now()
    const jobId = `image-${randomUUID().replaceAll('-', '').slice(0, 20)}`
    const record: JobRecord = {
      jobId,
      status: 'queued',
      createdAt,
      controller: new AbortController(),
    }
    this.jobs.set(jobId, record)
    void this.execute(record, input, run)
    return { jobId, status: record.status === 'queued' ? 'queued' : 'running', createdAt }
  }

  get(jobId: string): StudioJobStatusResponse | undefined {
    this.prune()
    const record = this.jobs.get(jobId)
    return record === undefined ? undefined : snapshot(record)
  }

  cancel(jobId: string): boolean {
    const record = this.jobs.get(jobId)
    if (record === undefined) return false
    if (record.status === 'completed' || record.status === 'failed' || record.status === 'cancelled') return true
    record.status = 'cancelled'
    record.finishedAt = Date.now()
    record.error = '已取消'
    record.controller.abort(new Error('image generation cancelled'))
    if (record.timeout !== undefined) clearTimeout(record.timeout)
    return true
  }

  dispose(): void {
    for (const record of this.jobs.values()) {
      if (record.timeout !== undefined) clearTimeout(record.timeout)
      if (record.status === 'queued' || record.status === 'running') record.controller.abort(new Error('image generation service stopped'))
    }
    this.jobs.clear()
  }

  private async execute(record: JobRecord, input: StudioGenerateRequest, run: StudioJobRunner): Promise<void> {
    // Let the HTTP handler return the job id before any provider work begins.
    await Promise.resolve()
    if (isCancelled(record)) return
    record.status = 'running'
    record.startedAt = Date.now()
    record.timeout = setTimeout(() => {
      if (record.status !== 'completed' && record.status !== 'failed' && record.status !== 'cancelled') {
        record.status = 'failed'
        record.finishedAt = Date.now()
        record.error = '图片生成超时，请稍后重试'
        record.controller.abort(new Error('image generation timed out'))
      }
    }, this.timeoutMs)
    record.timeout.unref?.()
    try {
      const result = await run(input, record.controller.signal)
      if (isStopped(record)) return
      record.status = 'completed'
      record.result = result
      record.finishedAt = Date.now()
    } catch (error) {
      if (isStopped(record)) return
      record.status = 'failed'
      record.finishedAt = Date.now()
      record.error = safeError(error)
    } finally {
      if (record.timeout !== undefined) clearTimeout(record.timeout)
      delete record.timeout
    }
  }

  private prune(): void {
    const cutoff = Date.now() - JOB_TTL_MS
    for (const [jobId, record] of this.jobs) {
      if (record.finishedAt !== undefined && record.finishedAt < cutoff) this.jobs.delete(jobId)
    }
    while (this.jobs.size > MAX_RETAINED_JOBS) {
      const oldest = this.jobs.keys().next().value
      if (oldest === undefined) break
      const record = this.jobs.get(oldest)
      if (record !== undefined && (record.status === 'queued' || record.status === 'running')) break
      this.jobs.delete(oldest)
    }
  }
}

function isCancelled(record: JobRecord): boolean {
  return record.status === 'cancelled'
}

function isStopped(record: JobRecord): boolean {
  return record.status === 'cancelled' || record.status === 'failed'
}

function snapshot(record: JobRecord): StudioJobStatusResponse {
  return {
    jobId: record.jobId,
    status: record.status,
    createdAt: record.createdAt,
    ...(record.startedAt === undefined ? {} : { startedAt: record.startedAt }),
    ...(record.finishedAt === undefined ? {} : { finishedAt: record.finishedAt }),
    ...(record.result === undefined ? {} : { result: record.result }),
    ...(record.error === undefined ? {} : { error: record.error }),
  }
}

function safeError(error: unknown): string {
  const message = error instanceof Error && error.message.trim().length > 0 ? error.message : String(error)
  // A failed provider may echo an image URL. The browser only receives local
  // attachment references, including on the error path.
  return redactSecrets(message).replace(/https?:\/\/[^\s"'<>]+/gi, '[upstream-url]')
}
