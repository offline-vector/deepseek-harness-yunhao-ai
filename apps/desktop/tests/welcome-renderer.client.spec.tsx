// @vitest-environment jsdom
/** Desktop welcome page stays credential-first and never exposes account login. */
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { Welcome } from '../src/client/WelcomePage.tsx'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveDesktopLocale } from '../src/locale.ts'
import type { AccountView } from '@deepseek-ai/dsh-deepseek-account/types'
import type { WelcomeSaveResult, WelcomeNotice } from '../src/welcome-api.ts'

afterEach(cleanup)

function mount(language = 'zh-CN', takeNotice = vi.fn<() => Promise<WelcomeNotice | undefined>>().mockResolvedValue(undefined)) {
  cleanup()
  const api = {
    takeNotice,
    analytics: vi.fn(async (_event: string, _attributes: object) => {}),
    analyticsEnabled: async () => true,
    onAccountState: vi.fn((_listener: (state: AccountView) => void) => vi.fn()),
    startSignIn: vi.fn(async (): Promise<AccountView> => ({ links: { usageUrl: '', topUpUrl: '' }, status: 'signed-out', attempt: null })),
    cancelSignIn: vi.fn(async (): Promise<AccountView> => ({ links: { usageUrl: '', topUpUrl: '' }, status: 'signed-out', attempt: null })),
    copySignInLink: vi.fn(async () => undefined),
    ...resolveDesktopLocale(language),
    saveApiKey: vi.fn<(value: string) => Promise<WelcomeSaveResult>>().mockResolvedValue({ ok: true }),
    skip: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  }
  const mounted = render(<Welcome api={api} />)
  const input = document.querySelector<HTMLInputElement>('#key-input')!
  const button = (id: string) => document.querySelector<HTMLButtonElement>(id)!
  const enterKey = (value: string) => { fireEvent.change(input, { target: { value } }) }
  const submit = () => { fireEvent.submit(document.querySelector('form')!) }
  return { document, api, input, button, enterKey, submit, unmount: mounted.unmount }
}

describe('desktop welcome presentation', () => {
  it.each(['zh-CN', 'en'])('opens directly on the API-key page: %s', async (language) => {
    const view = mount(language)
    expect(view.document.documentElement.lang).toBe(language)
    expect(view.document.querySelector('img')!.getAttribute('src')).toBe('assets/welcome-brand.svg')
    expect(view.document.querySelector('#key-form')).toBeTruthy()
    expect(view.button('#sign-in')).toBeNull()
    expect(view.document.querySelector('#auth-page')).toBeNull()
    expect(view.document.activeElement).toBe(view.input)
  })

  it('saves one trimmed key and blocks competing actions while saving', async () => {
    const view = mount()
    const saved = Promise.withResolvers<WelcomeSaveResult>()
    view.api.saveApiKey.mockReturnValue(saved.promise)
    view.enterKey('  sk-desktop-example  ')
    view.submit()
    view.submit()
    fireEvent.click(view.button('#skip-key'))
    expect(view.api.saveApiKey).toHaveBeenCalledExactlyOnceWith('sk-desktop-example')
    expect(view.api.skip).not.toHaveBeenCalled()
    expect(view.button('#save-key').disabled).toBe(true)
    saved.resolve({ ok: true })
    await vi.waitFor(() => { expect(view.input.value).toBe('') })
  })

  it.each(['', 'bad key', '密钥', 'DEEPSEEK_API_KEY=sk-example', '"sk-example"', '`sk-example`'])(
    'rejects invalid API key input: %s', (value) => {
      const view = mount()
      view.enterKey(value)
      view.submit()
      expect(view.api.saveApiKey).not.toHaveBeenCalled()
      expect(view.document.querySelector<HTMLElement>('#key-error')!.hidden).toBe(false)
      expect(view.input.getAttribute('aria-invalid')).toBe('true')
    },
  )

  it('keeps a refused key visible and allows retry', async () => {
    const view = mount()
    view.api.saveApiKey.mockResolvedValue({ ok: false })
    view.enterKey('sk-retry')
    view.submit()
    await vi.waitFor(() => { expect(view.button('#save-key').disabled).toBe(false) })
    expect(view.input.value).toBe('sk-retry')
    expect(view.document.querySelector('#key-error')!.textContent).toBe(view.api.messages.welcomeKeyFailed)
    view.api.saveApiKey.mockResolvedValue({ ok: true })
    view.submit()
    await vi.waitFor(() => { expect(view.input.value).toBe('') })
  })

  it('skips without saving and clears the draft', async () => {
    const view = mount()
    view.enterKey('sk-not-saved')
    fireEvent.click(view.button('#skip-key'))
    expect(view.api.skip).toHaveBeenCalledOnce()
    expect(view.api.saveApiKey).not.toHaveBeenCalled()
    await vi.waitFor(() => { expect(view.input.value).toBe('') })
  })

  it('shows a session-expired notice without restoring a login surface', async () => {
    const takeNotice = vi.fn<() => Promise<WelcomeNotice | undefined>>().mockResolvedValue('session-expired')
    const view = mount('en', takeNotice)
    await waitFor(() => {
      const alerts = [...view.document.querySelectorAll<HTMLElement>('[role="alert"]')]
      expect(alerts.find(alert => alert.textContent === view.api.messages.welcomeSessionExpired)).toBeTruthy()
    })
    expect(view.button('#sign-in')).toBeNull()
  })
})
