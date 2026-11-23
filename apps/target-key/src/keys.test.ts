import { describe, expect, it } from 'vitest'

import {
  eligibleProvidedKey, enrichMessage, InvalidTargetKeyInput,
  normalizeRoadLabel, prepareMessage,
} from './keys.js'

const uuid = '00000000-0000-4000-8000-000000000001'
const row = (extra = {}) => ({
  __balRowIndex: 0, commune_insee: '96001', voie_nom: 'RUE FICTIVE',
  numero: '12', suffixe: '', ...extra,
})
const prepared = (extra = {}) => prepareMessage({ id: 'synthetic-job', rows: [row(extra)] })
const enriched = (extra = {}, code = 'abc123') => {
  const input = prepared(extra)
  return enrichMessage(input, { [input.rowKeys[0]]: code }).rows[0]
}

describe('target-key message and interop selection', () => {
  it('accepts the opaque BAL identifier format emitted by ban-core-api', () => {
    const id = 'bal--2026-11-20T09-10-11.123Z--11111111-1111-4111-8111-111111111111'
    expect(prepareMessage({ id, rows: [row()] }).id).toBe(id)
  })
  it('preserves target-key output and emits computed/retained values separately', () => {
    expect(enriched({ suffixe: 'BIS' })).toMatchObject({
      suffixe: 'BIS', ban_enrich_deprecated_cle_interop: '96001_abc123_00012_bis',
      ban_enrich_retained_cle_interop: '96001_abc123_00012_bis',
      ban_enrich_ban_target_keys_address: ['96001~RUE-FICTIVE~12.BIS'],
      ban_enrich_ban_target_keys_toponym: ['96001~RUE-FICTIVE'],
      ban_enrich_ban_target_keys_district: ['96001'],
    })
  })

  it.each(['96001_a001_00012', '96002_a001_00012', '2a001_a001_00012_bis_a',
    '96001_abc123_00012_a_a', '96001_a001_00012_qua', '96001_a001_00012_qui',
    `96001_${uuid}_00012`])(
    'keeps a supported supplied key exactly, independently of the computed code (%s)', key => {
      expect(eligibleProvidedKey(key, 12)).toBe(true)
      const result = enriched({ cle_interop: key })
      expect(result).toMatchObject({ cle_interop: key, ban_enrich_retained_cle_interop: key })
      expect(result).not.toHaveProperty('ban_enrich_deprecated_cle_interop')
      expect(prepared({ cle_interop: key }).roads).toHaveLength(0)
    })

  it.each(['96001_x042_00012', '96001_xabc12_00012', '96001_0000_00012',
    '96001_xxxx_00012', '96001_A001_00012', '96001_a001_12',
    '96001_a001_00013', '96001_a001_00012_@@', '96001_a001_00012_bis_',
    '96001_a001_00012_quater', '96001_a001_00012_quinquies',
    '96001_a001_00012__a', '96001_a001_00012\n', '', 'nonsense',
  ])('keeps raw input but falls back (%s)', key => {
    expect(eligibleProvidedKey(key, 12)).toBe(false)
    expect(enriched({ cle_interop: key })).toMatchObject({
      cle_interop: key, ban_enrich_retained_cle_interop: '96001_abc123_00012',
    })
  })

  it('pads zero and preserves the source row without conflating historical export IDs', () => {
    const result = enriched({ numero: '0' })
    expect(result.ban_enrich_deprecated_cle_interop).toBe('96001_abc123_00000')
    expect(result).not.toHaveProperty('legacyCsvId')
    expect(result).not.toHaveProperty('DEPRECATED_id')
    expect(result).not.toHaveProperty('cle_interop')
  })

  it('keeps expanded suffix data unchanged when a nonconforming supplied key falls back', () => {
    for (const suffix of ['quater', 'quinquies']) {
      const source = `96001_a001_00012_${suffix}`
      const result = enriched({ suffixe: suffix, cle_interop: source })
      expect(result).toMatchObject({ cle_interop: source, suffixe: suffix,
        ban_enrich_deprecated_cle_interop: `96001_abc123_00012_${suffix}`,
        ban_enrich_retained_cle_interop: `96001_abc123_00012_${suffix}`,
      })
    }
  })

  it('does not strip accents or punctuation from registry labels', () => {
    expect(normalizeRoadLabel('  RUE  DE LA CO\u0302TE ')).toBe('rue de la côte')
    expect(normalizeRoadLabel('Rue de la Côte')).not.toBe(normalizeRoadLabel('Rue de la Cote'))
    expect(normalizeRoadLabel("Rue d'O")).not.toBe(normalizeRoadLabel('Rue d’O'))
  })

  it('loads the shipped abbreviation rules for long names and suffixes on Node24', () => {
    const name = 'AVENUE DE LA RESIDENCE FICTIVE DES NUAGES'
    const suffix = 'BATIMENT DE LA RESIDENCE FICTIVE DES NUAGES'
    const result = enriched({ voie_nom: name, suffixe: suffix })
    expect(result.ban_enrich_ban_target_keys_toponym)
      .toEqual(['96001~AV-DE-LA-RES-FICTIVE-DES-NUAGES'])
    expect(result.ban_enrich_ban_target_keys_address).toEqual([
      '96001~AV-DE-LA-RES-FICTIVE-DES-NUAGES~12.BAT-DE-LA-RES-FICTIVE-DES-NUAGES',
    ])
    expect(result.voie_nom).toBe(name)
    expect(result.suffixe).toBe(suffix)
    expect(enriched({ voie_nom: 'A'.repeat(33) }).ban_enrich_ban_target_keys_toponym)
      .toEqual(['96001~TOPONYM'])
  })

  it('allows different supplied codes for different addresses of the same way', () => {
    const input = prepareMessage({ id: 'synthetic-job', rows: [
      row({ cle_interop: '96001_a001_00012' }),
      row({ __balRowIndex: 1, numero: 13, cle_interop: '96001_b002_00013' }),
    ] })
    expect(enrichMessage(input, { [input.rowKeys[0]]: 'abc123' }).rows.map(r =>
      r.ban_enrich_retained_cle_interop)).toEqual(['96001_a001_00012', '96001_b002_00013'])
  })

  it('refuses contradictory retained values for the same address UUID', () => {
    const input = prepareMessage({ id: 'synthetic-job', rows: [
      row({ id_ban_adresse: uuid, cle_interop: '96001_a001_00012' }),
      row({ __balRowIndex: 1, id_ban_adresse: uuid, cle_interop: '96001_b002_00012' }),
    ] })
    expect(() => enrichMessage(input, { [input.rowKeys[0]]: 'abc123' }))
      .toThrow(InvalidTargetKeyInput)
  })

  it('accepts repeated positions coherently and preserves the message envelope', () => {
    const input = prepareMessage({ id: 'synthetic-job', meta: { fixture: true }, rows: [
      row({ id_ban_toponyme: uuid }), row({ __balRowIndex: 1, id_ban_toponyme: uuid }),
    ] })
    expect(input.roads).toHaveLength(1)
    expect(enrichMessage(input, { [input.rowKeys[0]]: 'abc123' })).toMatchObject({
      meta: { fixture: true }, rows: [{ __balRowIndex: 0 }, { __balRowIndex: 1 }],
    })
  })

  it('does not impose equality of COGs on the same toponym UUID', () => {
    const input = prepareMessage({ id: 'synthetic-job', rows: [
      row({ id_ban_toponyme: uuid }),
      row({ __balRowIndex: 1, id_ban_toponyme: uuid, commune_insee: '96002' }),
    ] })
    expect(input.roads.map(road => road.cog)).toEqual(['96001', '96002'])
  })

  it('resolves only fallback ways in a mixed message, without teaching supplied codes', () => {
    const input = prepareMessage({ id: 'mixed-job', rows: [
      row({ commune_insee: '96099', cle_interop: '96098_b001_00012' }),
      row({ __balRowIndex: 1, voie_nom: 'AUTRE VOIE' }),
    ] })
    expect(input.roads).toEqual([expect.objectContaining({ cog: '96001', label: 'autre voie' })])
    const result = enrichMessage(input, { [input.rowKeys[1]]: 'abc123' })
    expect(result.rows[0].ban_enrich_retained_cle_interop).toBe('96098_b001_00012')
    expect(result.rows[0]).not.toHaveProperty('ban_enrich_deprecated_cle_interop')
    expect(result.rows[1].ban_enrich_deprecated_cle_interop).toBe('96001_abc123_00012')
  })

  it('hashes object-key order consistently and rejects an oversized decoded message', () => {
    expect(prepareMessage({ rows: [row()], id: 'synthetic-job' }).inputHash)
      .toBe(prepared().inputHash)
    expect(() => prepareMessage({ id: 'synthetic-job', rows: [row()],
      extra: 'a'.repeat(20_000_001) })).toThrow(InvalidTargetKeyInput)
    const chunk = 'a'.repeat(1_000_000)
    expect(() => prepareMessage({ id: 'synthetic-job', rows: [row()],
      extra: Array.from({ length: 21 }, () => chunk) })).toThrow(InvalidTargetKeyInput)
  })

  it.each([
    { commune_insee: '96001\n' }, { id_ban_toponyme: `${uuid}\n` },
    { numero: '12\n' }, { numero: -1 }, { numero: '12abc' }, { numero: 1.5 },
    { suffixe: 2 }, { cle_interop: 12 }, { __balRowIndex: -1 }, { voie_nom: ' ' },
  ])('rejects invalid row fields before allocation (%j)', extra => {
    expect(() => prepared(extra)).toThrow(InvalidTargetKeyInput)
  })

  it('rejects contradictory labels under a toponym identity and duplicate row indices', () => {
    for (const rows of [
      [row(), row()],
      [row({ id_ban_toponyme: uuid }), row({ __balRowIndex: 1, id_ban_toponyme: uuid,
        voie_nom: 'AUTRE NOM FICTIF' })],
    ]) expect(() => prepareMessage({ id: 'synthetic-job', rows })).toThrow(InvalidTargetKeyInput)
    expect(() => prepareMessage({ id: 'synthetic-job\n', rows: [row()] }))
      .toThrow(InvalidTargetKeyInput)
  })
})
