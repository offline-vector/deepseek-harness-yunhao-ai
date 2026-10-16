/** Independent size and quality controls for official and compatible image APIs. */
import type { Config } from './config.js'
import type { StudioOption } from './shared.js'
export { compatGenerationExtraBody, compatWatermarkField, compatWatermarkOptions } from './watermark.js'

export const PROVIDER_DEFAULT_QUALITY = '__default__'
export const DEFAULT_COMPAT_QUALITIES = ['auto', 'low', 'medium', 'high']
const LEGACY_SIZES = ['1024x1024', '1536x1024', '1024x1536']
const OPENAI_SIZES: Record<string, Record<string, string>> = {
  '1:1': { '1K': '1024x1024', '2K': '2048x2048' },
  '3:2': { '1K': '1536x1024', '2K': '2304x1536' },
  '2:3': { '1K': '1024x1536', '2K': '1536x2304' },
  '4:3': { '1K': '1152x864', '2K': '2048x1536' },
  '3:4': { '1K': '864x1152', '2K': '1536x2048' },
  '16:9': { '1K': '1536x864', '2K': '2048x1152', '4K': '3840x2160' },
  '9:16': { '1K': '864x1536', '2K': '1152x2048', '4K': '2160x3840' },
}

function flexibleSizeModel(model: string): boolean {
  return /^gpt-image-2(?:$|[-.])/.test(model)
}

export function officialSizeTable(config: Config, model: string): Record<string, Record<string, string>> {
  if (config.openaiSizes && Object.keys(config.openaiSizes).length > 0) return config.openaiSizes
  if (flexibleSizeModel(model)) return OPENAI_SIZES
  return { '1:1': { '1K': LEGACY_SIZES[0]! }, '3:2': { '1K': LEGACY_SIZES[1]! }, '2:3': { '1K': LEGACY_SIZES[2]! } }
}

/** Check the official model contract before spending a request. Relays own their size contract. */
export function validateOfficialSize(model: string, size: string): void {
  if (size === 'auto') return
  if (!flexibleSizeModel(model)) {
    if (!LEGACY_SIZES.includes(size)) throw new Error(`模型 ${model} 不支持尺寸 ${size}；请使用 1024x1024、1536x1024 或 1024x1536`)
    return
  }
  const match = /^(\d+)x(\d+)$/.exec(size)
  const width = Number(match?.[1])
  const height = Number(match?.[2])
  const pixels = width * height
  if (!match || width % 16 !== 0 || height % 16 !== 0 || Math.max(width, height) > 3840
    || pixels < 655_360 || pixels > 8_294_400 || Math.max(width, height) > 3 * Math.min(width, height)) {
    throw new Error(`OpenAI 尺寸 ${size} 无效：边长须为 16 的倍数且不超过 3840，比例在 1:3 到 3:1，像素数在 655360 到 8294400`)
  }
}

export function officialQualityOptions(model: string): StudioOption[] {
  const values = ['auto', 'low', 'medium', 'high', ...(/^gpt-image-2\.5-(sunburst|flare)(?:$|-)/.test(model) ? ['xhigh', 'max'] : [])]
  return values.map(value => ({ value, label: value === 'auto' ? '自动' : value }))
}

export function compatQualityOptions(config: Config): StudioOption[] {
  const values = [...new Set([...(config.openaiCompatQualityOptions ?? DEFAULT_COMPAT_QUALITIES), config.openaiCompatQuality ?? '']
    .map(value => value.trim()).filter(value => value && value !== PROVIDER_DEFAULT_QUALITY))]
  return [{ value: PROVIDER_DEFAULT_QUALITY, label: '渠道默认（不发送）' }, ...values.map(value => ({ value, label: value }))]
}

export function compatRequestQuality(config: Config, selected?: string): string | undefined {
  const value = (selected ?? config.openaiCompatQuality)?.trim()
  return value && value !== PROVIDER_DEFAULT_QUALITY ? value : undefined
}
