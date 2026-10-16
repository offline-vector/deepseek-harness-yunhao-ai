/** S1API first-run credentials; drafts stay local and stored keys are never read back. */
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { TrackProductEvent } from '@deepseek-ai/dsh-client-product-analytics/client'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { ModelsSettingsState } from './store.ts'
import type { ModelsOperations } from './operations.ts'
import type { en } from './locales.ts'
import { providerUsable } from './store.ts'
import { ApiKeyInput } from './ApiKeyInput.tsx'
import { OnboardingModal } from './OnboardingModal.tsx'
import styles from './ModelsSection.module.css'
import css from './S1ApiOnboardingDialog.module.css'

/** Credential used by the S1API OpenAI-compatible image-generation route. */
const S1API_IMAGE_KEY_REF = 'DSH_IMAGE_GEN_OPENAI_COMPAT_KEY'

/** The shared Models join and credential operations used by first-run setup. */
export interface S1ApiOnboardingInjected {
  automatic: boolean
  track?: TrackProductEvent
  hooks: { models: SnapshotStore<ModelsSettingsState> }
  /** Refresh credential metadata without returning secret values. */
  load(): Promise<ModelsSettingsState>
  storeCredential: ModelsOperations['storeCredential']
  t: (key: keyof typeof en) => string
}

/** Settings coordinator callbacks plus the Models feature's injected state. */
export type S1ApiOnboardingDialogProps = Pick<PropsRuntime<'settings.onboarding'>, 'complete' | 'explicit'> & InjectFace<S1ApiOnboardingInjected>

/**
 * Offer the three configured S1API routes plus the optional image route until a key is saved or setup is skipped.
 * A failed multi-key save retains drafts; previously committed keys remain saved.
 * @param props - coordinator callbacks, Models snapshot and credential writer.
 * @returns the credential form, a retryable load error, or nothing for configured users.
 */
export function S1ApiOnboardingDialog(props: S1ApiOnboardingDialogProps): ReactNode {
  const { load, useModels, storeCredential, complete, t, automatic, explicit = false } = props
  const state = useModels(value => value)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [imageKeyDraft, setImageKeyDraft] = useState('')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [failure, setFailure] = useState<string | undefined>()
  const rows = ['openai', 'anthropic', 'google'].flatMap((provider) => {
    const row = state.rows.find(candidate => candidate.entry.provider === provider
      && candidate.entry.settingsNs === 'llm-pi-ai' && candidate.configured)
    return row?.apiKeyEnv === undefined ? [] : [row]
  })
  const enabled = automatic || explicit
  const ready = state.status === 'ready'
  const skip = !enabled || (ready && !editing && !explicit && state.rows.some(providerUsable))

  useEffect(() => {
    if (enabled && state.status === 'idle') void load()
  }, [enabled, state.status, load])
  useEffect(() => { if (skip) complete() }, [skip, complete])

  if (skip || state.status === 'idle' || (state.status === 'loading' && rows.length === 0)) return null

  const save = async (): Promise<void> => {
    const pending = rows.flatMap((row) => {
      const value = (drafts[row.entry.provider] ?? '').trim()
      const ref = row.apiKeyEnv
      return value.length === 0 || ref === undefined ? [] : [{ ref, value }]
    })
    const imageKey = imageKeyDraft.trim()
    if (imageKey.length > 0) pending.push({ ref: S1API_IMAGE_KEY_REF, value: imageKey })
    if (pending.length === 0) { setFailure(t('keyRequired')); return }
    if (pending.some(({ value }) => !/^[\x21-\x7e]+$/.test(value))) {
      setFailure(t('keyIllegalCharacters'))
      return
    }
    setEditing(true)
    setSaving(true)
    setFailure(undefined)
    props.track?.('api_key_save_click', {})
    try {
      for (const { ref, value } of pending) {
        const error = await storeCredential(ref, value)
        if (error !== undefined) { setFailure(t('s1SaveFailed')); return }
      }
      const refreshed = await load()
      if (refreshed.status !== 'ready' || refreshed.credentialError !== null) { setFailure(t('s1SaveFailed')); return }
      complete()
    } catch (_error) {
      // A disconnected write may already have committed; retain drafts for an idempotent retry.
      setFailure(t('s1SaveFailed'))
    } finally {
      setSaving(false)
    }
  }

  return <OnboardingModal title={t('s1SetupTitle')}>
    <form className={css.form} onSubmit={(event) => { event.preventDefault(); if (!saving) void save() }}>
      <p className={css.copy}>{t('s1SetupDescription')}</p>
      <a className={styles['linkButton']} href="https://s1api.com/keys" target="_blank" rel="noopener noreferrer">
        {t('getS1ApiKey')}
      </a>
      <p className={css.copy}>{t('s1ReturnHint')}</p>
      {(ready || state.status === 'loading') && state.credentialError === null && rows.length > 0 ? <>
        {rows.map(row => <label className={css.field} key={row.entry.provider}>
          <span>{row.entry.displayName}</span>
          <ApiKeyInput
            t={t} value={drafts[row.entry.provider] ?? ''} disabled={saving || !state.writable}
            aria-label={`${row.entry.displayName} ${t('keyInput')}`}
            placeholder={t(row.credential?.configured === true ? 'keyPlaceholderSaved' : 'keyPlaceholder')}
            onChange={(event) => {
              setEditing(true)
              setDrafts(previous => ({ ...previous, [row.entry.provider]: event.target.value }))
            }}
          />
        </label>)}
        <label className={css.field}>
          <span>{t('s1ImageKeyLabel')}</span>
          <ApiKeyInput
            t={t} value={imageKeyDraft} disabled={saving || !state.writable}
            aria-label={`${t('s1ImageKeyLabel')} ${t('keyInput')}`}
            placeholder={t('s1ImageKeyPlaceholder')}
            onChange={(event) => {
              setEditing(true)
              setImageKeyDraft(event.target.value)
            }}
          />
          <span className={css.hint}>{t('s1ImageKeyHint')}</span>
        </label>
        <p className={css.copy}>{t('s1DefaultHint')}</p>
        {!state.writable && <p role="alert" className={styles['error']}>{t('readOnly')}</p>}
      </> : <div>
        <p role="alert" className={styles['error']}>{t('loadFailed')}</p>
        <Button type="button" onClick={() => { void load() }}>{t('retry')}</Button>
      </div>}
      {failure !== undefined && <p role="alert" className={styles['error']}>{failure}</p>}
      <div className={css.actions}>
        <Button type="button" disabled={saving} onClick={complete}>{t('onboardingLater')}</Button>
        <Button type="submit" variant="primary" disabled={saving || !ready || !state.writable || rows.length === 0 || state.credentialError !== null}>
          {t(saving ? 'onboardingSaving' : 'onboardingSave')}
        </Button>
      </div>
    </form>
  </OnboardingModal>
}
