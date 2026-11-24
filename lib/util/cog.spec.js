import {getSirenCommune} from './cog.cjs'

describe('getSirenCommune', () => {
  it('returns the SIREN of a commune actuelle', () => {
    expect(getSirenCommune('60636')).toBe('216006270')
  })

  it('returns the SIREN of the parent commune for a municipal arrondissement', () => {
    expect(getSirenCommune('75101')).toBe('217500016')
    expect(getSirenCommune('69381')).toBe('216901231')
    expect(getSirenCommune('13201')).toBe('211300553')
  })

  it('returns the SIREN of the commune nouvelle for a commune déléguée', () => {
    expect(getSirenCommune('01039')).toBe('200099406')
  })

  it('returns undefined when the commune has no SIREN', () => {
    expect(getSirenCommune('97501')).toBeUndefined()
  })

  it('returns undefined for an unknown or missing code', () => {
    expect(getSirenCommune('00000')).toBeUndefined()
    expect(getSirenCommune(undefined)).toBeUndefined()
  })
})
