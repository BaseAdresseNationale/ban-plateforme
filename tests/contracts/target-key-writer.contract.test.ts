/** Cross-package contract: the real writer projection must survive persistence validation. */
import { expect, it } from 'vitest'

import { getBanObjectsFromBalRows } from '../../apps/ban-core-writer/src/helper.js'
import { banPgAddressSchema } from '../../packages/api/src/recovery/address.model.js'
import { banPgCommonToponymSchema } from '../../packages/api/src/recovery/commonToponym.model.js'
import { banPgDistrictSchema } from '../../packages/api/src/recovery/district.model.js'

it('preserves key metadata through the actual writer and persistence schemas', () => {
  const id = '00000000-0000-4000-8000-000000000001'
  const objects = getBanObjectsFromBalRows([{
    id_ban_commune: id, id_ban_toponyme: id, id_ban_adresse: id,
    commune_insee: '96001', commune_nom: 'Commune fictive', voie_nom: 'Voie fictive',
    numero: 12, position: 'entrée', long: 0, lat: 0,
    cle_interop: '96002_a001_00012',
    ban_enrich_retained_cle_interop: '96002_a001_00012',
    ban_enrich_ban_target_keys_address: ['96001~VOIE-FICTIVE~12'],
    ban_enrich_ban_target_keys_toponym: ['96001~VOIE-FICTIVE'],
    ban_enrich_ban_target_keys_district: ['96001'],
  }], 'fra')
  const address = banPgAddressSchema.parse(objects.addresses[id])
  expect(address.meta.interop).toEqual({ balProvidedKey: '96002_a001_00012' })
  expect(address.meta.interopSelection).toEqual({ retainedKey: '96002_a001_00012' })
  expect(address.meta.ban?.targetKeys).toEqual(['96001~VOIE-FICTIVE~12'])
  expect(banPgCommonToponymSchema.parse(objects.commonToponyms[id]).meta.ban?.targetKeys)
    .toEqual(['96001~VOIE-FICTIVE'])
  expect(banPgDistrictSchema.parse(objects.districts[id]).meta.ban?.targetKeys).toEqual(['96001'])
})
