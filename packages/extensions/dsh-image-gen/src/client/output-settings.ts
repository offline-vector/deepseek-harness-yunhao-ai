/** Validate all advanced output fields before the settings form starts writing. */
export function parseExtraFields(text: string, message: string): Record<string, unknown> {
  if (!text.trim()) return {}
  let value: unknown
  try { value = JSON.parse(text) } catch { throw new Error(message) }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(message)
  return value as Record<string, unknown>
}

export function parseSizeTable(text: string, message: string): Record<string, Record<string, string>> {
  const value = parseExtraFields(text, message)
  const table: Record<string, Record<string, string>> = {}
  for (const [ratio, tiers] of Object.entries(value)) {
    if (!/^\d+(?:\.\d+)?:\d+(?:\.\d+)?$/.test(ratio) || ratio.split(':').some(part => Number(part) <= 0)
      || typeof tiers !== 'object' || tiers === null || Array.isArray(tiers)) throw new Error(message)
    const entries = Object.entries(tiers)
    if (entries.length === 0 || entries.some(([tier, size]) => !/^(\d+(?:\.\d+)?)(K?)$/.test(tier) || Number.parseFloat(tier) <= 0 || typeof size !== 'string' || !size.trim())) throw new Error(message)
    table[ratio] = Object.fromEntries(entries.map(([tier, size]) => [tier, (size as string).trim()]))
  }
  return table
}
