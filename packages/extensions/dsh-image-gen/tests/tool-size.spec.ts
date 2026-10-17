import { describe, expect, it } from 'vitest'
import { s1APIImageModelProfile, s1APIImageToolSize } from '../src/shared.js'

describe('S1API image tool size mapping', () => {
  it('maps aspect_ratio to the relay size field', () => {
    expect(s1APIImageToolSize('https://s1api.com/v1', undefined, '16:9')).toBe('16:9')
  })

  it('keeps an explicit size ahead of the inferred ratio', () => {
    expect(s1APIImageToolSize('https://s1api.com/v1', '1024x1792', '9:16')).toBe('1024x1792')
  })

  it('does not apply the S1API mapping to another compatible relay', () => {
    expect(s1APIImageToolSize('https://example.com/v1', undefined, '16:9')).toBeUndefined()
  })

  it('defaults every S1API image model to automatic aspect ratio', () => {
    expect(s1APIImageModelProfile('gpt-image-2')?.defaultRatio).toBe('auto')
    expect(s1APIImageModelProfile('gpt-image-2-2k')?.defaultRatio).toBe('auto')
    expect(s1APIImageModelProfile('gpt-image-2-2k')?.ratioOptions.some(option => option.value === 'auto')).toBe(true)
  })
})
