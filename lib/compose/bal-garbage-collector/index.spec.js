import {jest} from '@jest/globals'
import {bddCommuneMock} from './__mocks__/revision-data-mock.js'

jest.unstable_mockModule('../../util/api-depot.cjs', async () => import('./__mocks__/api-depot-mock.js'))
jest.unstable_mockModule('./models.js', async () => import('./__mocks__/models-mock.js'))
jest.unstable_mockModule('../../util/api-id-fix.cjs', async () => import('./__mocks__/api-id-fix-mock.js'))

const {balGarbageCollector} = await import('./index.js')

describe('balGarbageCollector', () => {
  it('RevisionIDs from BAL and BAN are different', async () => {
    const communeGarbageCollector = await balGarbageCollector()
    expect(communeGarbageCollector).toEqual([bddCommuneMock[1].codeCommune, bddCommuneMock[2].codeCommune])
  })
})
