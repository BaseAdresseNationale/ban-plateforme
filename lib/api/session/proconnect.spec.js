import {startFakeProConnect, invalidTokenCases} from '../__integration__/fake-proconnect.js'
import {ProConnectVerificationError, verifyProConnectTokens} from './proconnect.js'

const SUB = 'unit-test-sub'
const SIRET = '21600627000017'
const previousEnv = {}
let provider

beforeAll(async () => {
  provider = await startFakeProConnect()
  previousEnv.url = process.env.PROCONNECT_PROVIDER_URL
  previousEnv.clientId = process.env.PROCONNECT_CLIENT_ID
  process.env.PROCONNECT_PROVIDER_URL = provider.url
  process.env.PROCONNECT_CLIENT_ID = provider.clientId
})

afterAll(async () => {
  for (const [key, name] of [['url', 'PROCONNECT_PROVIDER_URL'], ['clientId', 'PROCONNECT_CLIENT_ID']]) {
    if (previousEnv[key] === undefined) {
      delete process.env[name]
    } else {
      process.env[name] = previousEnv[key]
    }
  }

  await provider.close()
})

describe('verifyProConnectTokens', () => {
  test('valid tokens give the identity with acr and amr', async () => {
    const identity = await verifyProConnectTokens(await provider.createTokens({sub: SUB, siret: SIRET}))

    expect(identity).toMatchObject({
      sub: SUB,
      email: `${SUB}@example.test`,
      siret: SIRET,
      givenName: 'Camille',
      usualName: 'Test',
      acr: 'eidas1',
      amr: ['pwd'],
      aud: provider.clientId,
      iss: provider.url,
    })
  })

  test.each(invalidTokenCases)('$name is refused', async ({build}) => {
    const tokens = await build({provider, sub: SUB, siret: SIRET})

    await expect(verifyProConnectTokens(tokens)).rejects.toBeInstanceOf(ProConnectVerificationError)
  })
})
