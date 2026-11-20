import { expect, it, vi } from 'vitest'

vi.mock('@ban/tools', () => ({ getUUIDv4: () => '00000000-0000-4000-8000-000000000001' }))

import { districtMetaSchema } from './schema.js'

it('keeps only the targeting keys supported by the district API schema', () => {
  expect(districtMetaSchema.parse({ ban: { targetKeys: ['96001'], arbitrary: 'ignored' } }))
    .toEqual({ ban: { targetKeys: ['96001'] } })
  expect(districtMetaSchema.parse({})).toEqual({})
})
