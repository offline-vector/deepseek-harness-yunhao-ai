// @vitest-environment jsdom
/** First-run S1API setup, external key acquisition and partial write recovery. */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import { bindSnapshotSelector } from '@deepseek-ai/dsh-client-test-runtime'
import { S1ApiOnboardingDialog } from '../src/client/S1ApiOnboardingDialog.tsx'
import type { S1ApiOnboardingDialogProps } from '../src/client/S1ApiOnboardingDialog.tsx'
import type { ModelsSettingsState } from '../src/client/store.ts'
import { en } from '../src/client/locales.ts'

afterEach(cleanup)

function harness(configured = false) {
  const store = createSnapshotStore<ModelsSettingsState>({
    status: 'ready', error: null, credentialError: null, writable: true, namespaces: new Map(),
    rows: [
      ['openai', 'OpenAI', 'OPENAI_API_KEY'],
      ['anthropic', 'Claude', 'ANTHROPIC_API_KEY'],
      ['google', 'Gemini', 'GEMINI_API_KEY'],
    ].map(([provider, displayName, apiKeyEnv]) => ({
      entry: { provider: provider!, displayName: displayName!, settingsNs: 'llm-pi-ai', settingsPath: ['providers', provider!], active: true },
      configured: true, removable: false, apiKeyEnv: apiKeyEnv!,
      credential: { configured, writable: true, ...(configured ? { source: 'file' as const } : {}) },
    })),
  })
  const storeCredential = vi.fn(async (_ref: string, _value: string): Promise<string | undefined> => undefined)
  const complete = vi.fn()
  const load = vi.fn(async () => store.getSnapshot())
  const props: S1ApiOnboardingDialogProps = {
    automatic: true, useModels: bindSnapshotSelector(store), storeCredential, load, complete, t: key => en[key],
  }
  return { props, store, storeCredential, complete, load }
}

it('keeps masked drafts and focus across a refresh while offering the S1API key link', () => {
  const h = harness()
  render(<S1ApiOnboardingDialog {...h.props} />)
  for (const provider of ['OpenAI', 'Claude', 'Gemini']) {
    expect(screen.getByLabelText(`${provider} API key`).getAttribute('type')).toBe('password')
  }
  const key = screen.getByLabelText<HTMLInputElement>('OpenAI API key')
  fireEvent.change(key, { target: { value: 'sk-openai' } })
  key.focus()
  act(() => { h.store.update((state) => { state.status = 'loading' }) })
  expect(screen.getByLabelText('OpenAI API key')).toBe(key)
  expect(document.activeElement).toBe(key)
  act(() => { h.store.update((state) => { state.status = 'ready' }) })
  const link = screen.getByRole('link', { name: en.getS1ApiKey })
  expect(link.getAttribute('href')).toBe('https://s1api.com/keys')
  expect(link.getAttribute('target')).toBe('_blank')
  expect(link.getAttribute('rel')).toContain('noopener')
  expect(key.value).toBe('sk-openai')
  expect(screen.queryByRole('button', { name: /sign in/i })).toBeNull()
})

it('saves only filled provider keys and does not call a model', async () => {
  const h = harness()
  render(<S1ApiOnboardingDialog {...h.props} />)
  fireEvent.change(screen.getByLabelText('OpenAI API key'), { target: { value: ' sk-openai ' } })
  fireEvent.change(screen.getByLabelText('Gemini API key'), { target: { value: 'sk-gemini' } })
  fireEvent.click(screen.getByRole('button', { name: en.onboardingSave }))
  await waitFor(() => { expect(h.complete).toHaveBeenCalledOnce() })
  expect(h.storeCredential.mock.calls).toEqual([['OPENAI_API_KEY', 'sk-openai'], ['GEMINI_API_KEY', 'sk-gemini']])
  expect(h.load).toHaveBeenCalledOnce()
})

it('keeps all drafts and the dialog when a later key write fails', async () => {
  const h = harness()
  h.storeCredential.mockImplementation(async (ref) => {
    if (ref === 'ANTHROPIC_API_KEY') throw new Error('disconnected')
    h.store.update((state) => { state.rows[0]!.credential = { configured: true, writable: true, source: 'file' } })
    return undefined
  })
  render(<S1ApiOnboardingDialog {...h.props} />)
  fireEvent.change(screen.getByLabelText('OpenAI API key'), { target: { value: 'sk-openai' } })
  fireEvent.change(screen.getByLabelText('Claude API key'), { target: { value: 'sk-claude' } })
  fireEvent.click(screen.getByRole('button', { name: en.onboardingSave }))
  expect((await screen.findByRole('alert')).textContent).toBe(en.s1SaveFailed)
  expect(h.complete).not.toHaveBeenCalled()
  expect(screen.getByLabelText<HTMLInputElement>('Claude API key').value).toBe('sk-claude')
  expect(screen.getByRole<HTMLButtonElement>('button', { name: en.onboardingSave }).disabled).toBe(false)
})

it('rejects empty and malformed keys without writing', async () => {
  const h = harness()
  render(<S1ApiOnboardingDialog {...h.props} />)
  fireEvent.click(screen.getByRole('button', { name: en.onboardingSave }))
  expect((await screen.findByRole('alert')).textContent).toBe(en.keyRequired)
  fireEvent.change(screen.getByLabelText('OpenAI API key'), { target: { value: 'sk-key with spaces' } })
  fireEvent.click(screen.getByRole('button', { name: en.onboardingSave }))
  expect((await screen.findByRole('alert')).textContent).toBe(en.keyIllegalCharacters)
  expect(h.storeCredential).not.toHaveBeenCalled()
})

it('skips configured users and allows explicit deferral without saving', async () => {
  const configured = harness(true)
  const view = render(<S1ApiOnboardingDialog {...configured.props} />)
  await waitFor(() => { expect(configured.complete).toHaveBeenCalled() })
  expect(screen.queryByRole('dialog')).toBeNull()
  view.unmount()
  const fresh = harness()
  render(<S1ApiOnboardingDialog {...fresh.props} />)
  fireEvent.click(screen.getByRole('button', { name: en.onboardingLater }))
  expect(fresh.complete).toHaveBeenCalledOnce()
  expect(fresh.storeCredential).not.toHaveBeenCalled()
})
