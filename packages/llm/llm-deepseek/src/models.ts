/** Default DeepSeek model catalog. */
import { DEFAULT_CONTEXT_WINDOW } from './defaults.ts'
import type { DeepSeekCatalogModel } from './types.ts'

/** S1API text model entries; deployments may replace the catalog. */
export const DEFAULT_MODELS: DeepSeekCatalogModel[] = [
  {
    id: 'gpt-5.6-sol',
    name: 'GPT-5.6 Sol',
    contextWindow: DEFAULT_CONTEXT_WINDOW,
    inputModalities: ['text'],
    systemPromptUpdate: 'in-history',
    toolUpdate: 'addition-only',
  },
  {
    id: 'gpt-5.6-terra',
    name: 'GPT-5.6 Terra',
    contextWindow: DEFAULT_CONTEXT_WINDOW,
  },
  { id: 'gpt-6-astra', name: 'GPT-6 Astra', contextWindow: DEFAULT_CONTEXT_WINDOW },
  { id: 'gpt-6-sol', name: 'GPT-6 Sol', contextWindow: DEFAULT_CONTEXT_WINDOW },
  { id: 'gpt-6.1-sol', name: 'GPT-6.1 Sol', contextWindow: DEFAULT_CONTEXT_WINDOW },
]
