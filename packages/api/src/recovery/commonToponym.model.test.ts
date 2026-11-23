import { expect, it, vi } from 'vitest'

vi.mock('@ban/tools', () => ({ getUUIDv4: () => '00000000-0000-4000-8000-000000000001' }))

import { banPgCommonToponymSchema } from './commonToponym.model.js'

it('keeps typed toponym target keys without accepting address interop fields', () => {
  const id = '00000000-0000-4000-8000-000000000001'
  const result = banPgCommonToponymSchema.parse({ id, districtID: id,
    meta: { ban: { targetKeys: ['synthetic'] }, interop: { banComputedKey: 'address-only' } } })
  expect(result.meta).toEqual({ ban: { targetKeys: ['synthetic'] } })
})
