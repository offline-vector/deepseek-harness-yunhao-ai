/**
 * Grok subscription image vendor.
 *
 * Adapted from @goodandready/dsh-subscriptions (MIT, (c) 2026 GooDAnDReaDY)
 * lib/vendors/grok.js and lib/images.js — only the pieces the image channel
 * needs: authorize URL, code exchange, refresh, and the generations call
 * (grok-cli token, not an xAI API key).
 */
import { buildAuthorizeUrl, emailFromToken, formTokenRequest, type Pkce } from '../oauth.js'
import type { SubscriptionBlob } from '../blob.js'

const GROK_AUTH = 'https://auth.x.ai/oauth2/authorize'
const GROK_TOKEN = 'https://auth.x.ai/oauth2/token'
const GROK_SCOPE = 'openid profile email offline_access grok-cli:access api:access conversations:read conversations:write'

/** Where the Grok subscription image request goes. */
export const GROK_IMAGE_URL = 'https://api.x.ai/v1/images/generations'
/** Where the Grok subscription image edit request goes. */
export const GROK_IMAGE_EDIT_URL = 'https://api.x.ai/v1/images/edits'
/** The model served by this endpoint. */
export const GROK_IMAGE_MODEL = 'grok-imagine-image-2.0'

/** Public client id of the grok-cli; vendor-fixed redirect on 127.0.0.1:56121. */
export const GROK_CLIENT_ID = 'b1a00492-073a-47ea-816f-4c329264a828'
export const GROK_REDIRECT_URI = 'http://127.0.0.1:56121/callback'

export function grokConfig(): { clientId: string; redirectUri: string } {
  return { clientId: GROK_CLIENT_ID, redirectUri: GROK_REDIRECT_URI }
}

export function grokAuthorizeUrl(cfg: { clientId: string; redirectUri: string }, pkce: Pkce): string {
  return buildAuthorizeUrl({
    authUrl: GROK_AUTH,
    clientId: cfg.clientId,
    redirectUri: cfg.redirectUri,
    challenge: pkce.challenge,
    state: pkce.state,
    scope: GROK_SCOPE,
  })
}

/** Identity fields every grok.com call must carry (the API host ignores them). */
export function grokIdentityHeaders(blob: SubscriptionBlob): Record<string, string> {
  return {
    authorization: `Bearer ${blob.accessToken}`,
    'X-XAI-Token-Auth': 'xai-grok-cli',
    'x-grok-client-identifier': 'grok-shell',
    'x-grok-client-version': '0.2.103',
    'User-Agent': 'xai-grok-cli',
    'content-type': 'application/json',
    accept: 'application/json',
  }
}

function tokenBlobFromOAuth(json: Record<string, unknown>): SubscriptionBlob {
  const access = json.access_token
  const refresh = json.refresh_token
  return {
    accessToken: typeof access === 'string' ? access : '',
    refreshToken: typeof refresh === 'string' ? refresh : '',
    expiresAt: Date.now() + (Number(json.expires_in) || 3600) * 1000,
    label: '',
    email: '',
    accountId: '',
  }
}

export async function grokExchangeCode(cfg: { clientId: string; redirectUri: string }, pkce: Pkce, code: string): Promise<SubscriptionBlob> {
  const json = await formTokenRequest(GROK_TOKEN, {
    grant_type: 'authorization_code',
    client_id: cfg.clientId,
    code,
    redirect_uri: cfg.redirectUri,
    code_verifier: pkce.verifier,
  }, fetch)
  const blob = tokenBlobFromOAuth(json)
  return { ...blob, email: blob.email.length > 0 ? blob.email : emailFromToken(blob.accessToken), label: 'Grok' }
}

export async function grokRefresh(blob: SubscriptionBlob): Promise<SubscriptionBlob> {
  const json = await formTokenRequest(GROK_TOKEN, {
    grant_type: 'refresh_token',
    client_id: GROK_CLIENT_ID,
    refresh_token: blob.refreshToken,
  }, fetch)
  const next = tokenBlobFromOAuth(json)
  return {
    ...next,
    refreshToken: next.refreshToken.length > 0 ? next.refreshToken : blob.refreshToken,
    label: blob.label.length > 0 ? blob.label : 'Grok',
    email: blob.email.length > 0 ? blob.email : next.email,
  }
}
