import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { TABLES, validate, render, writePackage } from './fixture.mjs'

const districtId = '11111111-1111-4111-8111-111111111111'
const toponymId = '00000000-0000-4000-8000-000000000001'
const addressId = '00000000-0000-4000-8000-000000000002'
function sample() {
  const district = { id: districtId, meta: { insee: { cog: '96001', mainId: districtId } },
    updateDate: '2026-10-01T00:00:00+00:00', range_validity: '["2026-10-01 00:00:00+00",)' }
  const toponym = { ...district, id: toponymId, districtID: districtId }
  const address = { ...toponym, id: addressId, mainCommonToponymID: toponymId, secondaryCommonToponymIDs: [] }
  const tables = { district: [district], district_h: [], common_toponym: [toponym], common_toponym_h: [], address: [address], address_h: [] }
  const schema = Object.fromEntries(TABLES.map(t => [t, Object.keys(tables[t][0] ?? tables[t.slice(0, -2)][0]).map(name => ({ name,
    type: name === 'range_validity' ? 'tstzrange' : name === 'updateDate' ? 'timestamp with time zone' : name === 'meta' ? 'jsonb' : name === 'secondaryCommonToponymIDs' ? 'uuid[]' : 'uuid',
  }))]))
  return { format: 'ban-fixture-96-v1', department: '96', source_database: 'ban', tables, schema,
    excluded_dependencies: { actions: 0, certificates: 0 } }
}

test('périmètre autonome accepté', () => {
  assert.deepEqual(validate(sample()), { district: 1, district_h: 0, common_toponym: 1, common_toponym_h: 0, address: 1, address_h: 0 })
})
test('plusieurs communes 96 et références internes au département acceptées', () => {
  const p = sample()
  const secondDistrictId = '00000000-0000-4000-8000-000000000003'
  const secondToponymId = '00000000-0000-4000-8000-000000000004'
  const secondAddressId = '00000000-0000-4000-8000-000000000005'
  p.tables.district.push({ ...p.tables.district[0], id: secondDistrictId,
    meta: { insee: { cog: '96002', mainId: secondDistrictId } } })
  p.tables.common_toponym.push({ ...p.tables.common_toponym[0], id: secondToponymId, districtID: secondDistrictId })
  p.tables.address.push({ ...p.tables.address[0], id: secondAddressId, districtID: secondDistrictId,
    secondaryCommonToponymIDs: [secondToponymId] })
  p.tables.district_h.push({ ...p.tables.district[1], range_validity: '["2026-09-01 00:00:00+00","2026-10-01 00:00:00+00")' })
  assert.deepEqual(validate(p), { district: 2, district_h: 1, common_toponym: 2, common_toponym_h: 0, address: 2, address_h: 0 })
})
test('toponyme secondaire extérieur refusé', () => {
  const p = sample(); p.tables.address[0].secondaryCommonToponymIDs = [addressId]
  assert.throws(() => validate(p), /extérieur/)
})
test('historique orphelin refusé', () => {
  const p = sample(); p.tables.address_h = [{ ...p.tables.address[0], id: toponymId }]
  assert.throws(() => validate(p), /sans objet actuel/)
})
test('version de commune hors 96 refusée', () => {
  const p = sample(); p.tables.district_h = [{ ...p.tables.district[0], meta: { insee: { cog: '75001' } } }]
  assert.throws(() => validate(p), /hors département/)
})
test('dépendances de workflow non nulles refusées', () => {
  const p = sample(); p.excluded_dependencies.actions = 1
  assert.throws(() => validate(p), /périmètre/)
})
test('colonnes inconnues refusées', () => {
  const p = sample(); p.tables.address[0].unknown = 'test'
  assert.throws(() => validate(p), /Colonnes de données/)
})
test('doublon actuel refusé', () => {
  const p = sample(); p.tables.district.push({ ...p.tables.district[0] })
  assert.throws(() => validate(p), /Doublon/)
})
test('contenu SQL et quotes restent dans le littéral JSON', () => {
  const p = sample(); p.tables.district[0].meta.note = "$ban_fixture$ ' ; DROP DATABASE ban; --"
  const sql = render(p)
  assert.ok(sql.includes('VALUES ($ban_fixture_$'))
  assert.ok(sql.includes("current_database() IN ('ban', 'postgres', 'template0', 'template1')"))
  assert.ok(sql.includes('SET CONSTRAINTS ALL IMMEDIATE;'))
  assert.ok(sql.trimEnd().endsWith('COMMIT;'))
})
test('aucun écrasement des exports existants', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ban-fixture-unit-'))
  const output = path.join(temp, 'output')
  try {
    writePackage(sample(), output)
    const before = fs.readFileSync(path.join(output, 'data.json'), 'utf8')
    assert.throws(() => writePackage(sample(), output), /EEXIST/)
    assert.equal(fs.readFileSync(path.join(output, 'data.json'), 'utf8'), before)
  } finally {
    // Seulement le répertoire temporaire créé par ce test ; aucune donnée réelle.
    fs.rmSync(temp, { recursive: true })
  }
})
test('le wrapper refuse ban avant toute connexion Docker', () => {
  const directory = path.dirname(fileURLToPath(import.meta.url))
  const result = spawnSync('/bin/bash', [path.join(directory, 'import-test-96.sh'), '--apply', path.join(directory, 'README.md')], {
    env: { ...process.env, PATH: '/__no_executables__', TARGET_DATABASE: 'ban', CONFIRM_TARGET: 'ban' }, encoding: 'utf8',
  })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /Base protégée/)
  assert.equal(result.stdout, '')
})
