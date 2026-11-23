import { expect, it, vi } from 'vitest'

vi.mock('@ban/tools', () => ({ getUUIDv4: () => '00000000-0000-4000-8000-000000000001' }))

import { banDistrictSchema } from './district.model.js'

it('preserves district targeting metadata and continues accepting no enrichment', () => {
  expect(banDistrictSchema.parse({ meta: { ban: { targetKeys: ['96001'] } } }).meta.ban)
    .toEqual({ targetKeys: ['96001'] })
  expect(banDistrictSchema.parse({}).meta).toEqual({})
})
