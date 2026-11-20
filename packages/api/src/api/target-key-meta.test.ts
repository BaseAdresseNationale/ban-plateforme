import { describe, expect, it } from 'vitest'

import {
  interopMetaSchema, interopSelectionSchema, targetKeyBanMetaSchema,
} from './target-key-meta.js'

describe('narrow target-key persistence metadata', () => {
  it('keeps empty raw source but rejects an empty computed or retained value', () => {
    expect(interopMetaSchema.parse({ balProvidedKey: '' })).toEqual({ balProvidedKey: '' })
    expect(interopMetaSchema.safeParse({ banComputedKey: '' }).success).toBe(false)
    expect(interopSelectionSchema.safeParse({ retainedKey: '' }).success).toBe(false)
  })
  it('does not allow arbitrary internal fields or empty synthetic target keys', () => {
    expect(targetKeyBanMetaSchema.parse({ targetKeys: ['synthetic'], arbitrary: 'ignored' }))
      .toEqual({ targetKeys: ['synthetic'] })
    expect(targetKeyBanMetaSchema.safeParse({ targetKeys: [''] }).success).toBe(false)
    expect(targetKeyBanMetaSchema.parse({})).toEqual({})
  })
})
