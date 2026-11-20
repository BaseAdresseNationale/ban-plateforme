import { expect, it, vi } from 'vitest'

vi.mock('@ban/tools', () => ({ getUUIDv4: () => '00000000-0000-4000-8000-000000000001' }))

import { banPgAddressSchema } from './address.model.js'

it('preserves only typed address key metadata rather than stripping the new fields', () => {
  const id = '00000000-0000-4000-8000-000000000001'
  const meta = { ban: { targetKeys: ['synthetic'], arbitrary: 1 },
    interop: { balProvidedKey: 'raw', banComputedKey: 'computed' },
    interopSelection: { retainedKey: 'retained' } }
  const result = banPgAddressSchema.parse({ id, districtID: id, mainCommonToponymID: id,
    secondaryCommonToponymIDs: [], number: 12, labels: [], positions: [], certified: false, meta })
  expect(result.meta).toEqual({ ...meta, ban: { targetKeys: ['synthetic'] } })
})
