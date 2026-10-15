// @vitest-environment jsdom
/** Yunhao's shipped composition keeps settings and omits both account login surfaces. */
import { afterEach, expect, vi } from 'vitest'
import { createClientTest, webApp } from '@deepseek-ai/dsh-client-test-runtime/src/assembly/index.ts'

const it = createClientTest({ roster: webApp })
afterEach(() => { vi.unstubAllGlobals() })

for (const desktop of [false, true]) it(`offers S1API setup without account login (desktop=${desktop})`, async ({ start }) => {
  if (desktop) vi.stubGlobal('dshDesktop', {})
  const c = await start()
  expect(c.ctx.slots.entries('settings.launcher')).toHaveLength(0)
  expect(c.ctx.slots.entries('settings.models.sign-in')).toHaveLength(0)
  expect(c.ctx.slots.entries('settings.section').some(entry => entry.options.id === 'models')).toBe(true)
  expect(c.ctx.slots.entries('settings.section').some(entry => entry.options.id === 'account')).toBe(false)
  expect(c.ctx.slots.entries('shell.overlay').some(entry => entry.options.id === 'desktop-onboarding')).toBe(false)
  expect(c.ctx.slots.entries('settings.onboarding').some(entry => entry.options.id === 's1api')).toBe(true)
  expect(c.mock.remote.account.startSignIn).not.toHaveBeenCalled()
}, 60_000)
