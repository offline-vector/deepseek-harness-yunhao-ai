/** Compact S1API image-model selector placed immediately before the chat model. */
import { useEffect, useState } from 'react'
import { S1API_IMAGE_MODELS } from '../shared.js'
import type { LocaleService } from './gallery-view.js'
import type { SettingsScope } from './index.js'
import { writeSetting } from './settings-write.js'

interface ImageModelPillSettings {
  provider?: string
  openaiCompatModel?: string
  showImageModelPill?: boolean
}

export interface ImageModelPillFace {
  scope: SettingsScope<ImageModelPillSettings>
  locale?: LocaleService | undefined
}

const DEFAULT_IMAGE_MODEL = S1API_IMAGE_MODELS[0]

const DICT = {
  zh: {
    label: '图片模型',
    ariaLabel: '选择图片模型',
    hint: '选择后会作为 S1API 默认图片模型，并切换到 OpenAI 兼容 Provider。',
    saveFailed: '图片模型保存失败',
  },
  en: {
    label: 'Image',
    ariaLabel: 'Select image model',
    hint: 'The selected model becomes the S1API default image model and switches to the OpenAI-compatible provider.',
    saveFailed: 'Failed to save image model',
  },
} as const

type Lang = keyof typeof DICT

function modelOf(value: ImageModelPillSettings | undefined): string {
  const model = value?.openaiCompatModel?.trim()
  return model !== undefined && model.length > 0 ? model : DEFAULT_IMAGE_MODEL
}

function optionsOf(model: string): readonly string[] {
  return (S1API_IMAGE_MODELS as readonly string[]).includes(model)
    ? S1API_IMAGE_MODELS
    : [model, ...S1API_IMAGE_MODELS]
}

export function ImageModelPill(props: ImageModelPillFace) {
  const [snapshot, setSnapshot] = useState(() => props.scope.getSnapshot())
  const [lang, setLang] = useState<Lang>(() => (props.locale?.getSnapshot?.()?.active?.startsWith('en') ? 'en' : 'zh'))
  const [selected, setSelected] = useState(() => modelOf(snapshot.value))
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => props.scope.subscribe(() => {
    const next = props.scope.getSnapshot()
    setSnapshot(next)
    if (!pending) setSelected(modelOf(next.value))
  }), [pending, props.scope])

  useEffect(() => props.locale?.subscribe?.(() => {
    setLang(props.locale?.getSnapshot?.()?.active?.startsWith('en') ? 'en' : 'zh')
  }), [props.locale])

  if (snapshot.value?.showImageModelPill === false) return null

  const dict = DICT[lang]
  const writable = snapshot.writable
  const current = modelOf(snapshot.value)
  const value = pending ? selected : current

  const select = (next: string): void => {
    if (pending || next === current && snapshot.value?.provider === 'openai-compat') return
    setSelected(next)
    setError('')
    setPending(true)
    void writeSetting(props.scope, 'openaiCompatModel', next, dict.saveFailed)
      .then(async () => {
        if (snapshot.value?.provider !== 'openai-compat') {
          await writeSetting(props.scope, 'provider', 'openai-compat', dict.saveFailed)
        }
      })
      .catch((cause: unknown) => {
        setSelected(current)
        setError(cause instanceof Error ? cause.message : String(cause))
      })
      .finally(() => { setPending(false) })
  }

  return (
    <label className="dsh-ig-image-model-root" title={dict.hint}>
      <span className="dsh-ig-image-model-icon" aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1.5" y="2.5" width="13" height="11" rx="2" />
          <circle cx="5.5" cy="6.5" r="1.3" />
          <path d="M14.5 10.5l-3.2-3.2-6.3 6.2" />
        </svg>
      </span>
      <span className="dsh-ig-image-model-label">{dict.label}</span>
      <select
        className="dsh-ig-image-model-select"
        aria-label={dict.ariaLabel}
        value={value}
        disabled={!writable || pending}
        onChange={(event) => { select(event.target.value) }}
      >
        {optionsOf(value).map(model => <option key={model} value={model}>{model}</option>)}
      </select>
      {error.length > 0 ? <span className="dsh-ig-image-model-error" role="alert">{error}</span> : null}
    </label>
  )
}

export const IMAGE_MODEL_PILL_STYLE = `
.dsh-ig-image-model-root{display:inline-flex;align-items:center;gap:5px;height:28px;min-width:0;padding:0 7px 0 8px;border:1px solid var(--dsw-alias-border-l2,#e5e7eb);border-radius:14px;background:var(--dsw-alias-bg-layer-3,#fff);color:var(--dsw-alias-label-secondary,#4b5563);font:inherit;font-size:13px;line-height:20px;cursor:pointer;-webkit-user-select:none;user-select:none}
.dsh-ig-image-model-root:focus-within{border-color:var(--dsw-alias-brand-primary,#4c78ff);color:var(--dsw-alias-label-primary,#111827);outline:2px solid var(--dsw-alias-brand-primary,#4c78ff);outline-offset:1px}
.dsh-ig-image-model-icon{display:inline-flex;flex:none;color:var(--dsw-alias-brand-primary,#4c78ff)}
.dsh-ig-image-model-label{flex:none;font-size:12px;color:var(--dsw-alias-label-tertiary,#6b7280)}
.dsh-ig-image-model-select{min-width:116px;max-width:190px;padding:0 13px 0 0;border:0;background:transparent;color:var(--dsw-alias-label-primary,#111827);font:inherit;font-size:12px;line-height:24px;cursor:pointer;outline:0;text-overflow:ellipsis}
.dsh-ig-image-model-select:disabled{opacity:.55;cursor:not-allowed}
.dsh-ig-image-model-error{position:absolute;z-index:1000;margin-top:48px;max-width:280px;padding:5px 8px;border-radius:7px;background:rgba(239,68,68,.95);color:#fff;font-size:11px;line-height:1.35;white-space:normal}
@container (max-width:700px){.dsh-ig-image-model-label{display:none}.dsh-ig-image-model-select{min-width:84px;max-width:126px}.dsh-ig-image-model-root{padding:0 7px}}
`
