import http from 'node:http'
import {SignJWT, exportJWK, generateKeyPair} from 'jose'

// Test-only stand-in for ProConnect: discovery document, JWKS and token signing with known keys.
export const FAKE_CLIENT_ID = 'integration-test-client'
const KID = 'integration-test-key'
const ALG = 'RS256'

const nowInSeconds = () => Math.floor(Date.now() / 1000)

export const startFakeProConnect = async () => {
  const providerKeys = await generateKeyPair(ALG, {extractable: true})
  const foreignKeys = await generateKeyPair(ALG, {extractable: true})
  const publicJwk = {...await exportJWK(providerKeys.publicKey), kid: KID, alg: ALG, use: 'sig'}

  const server = http.createServer((req, res) => {
    const issuer = `http://127.0.0.1:${server.address().port}`
    const routes = {
      '/.well-known/openid-configuration': {issuer, jwks_uri: `${issuer}/jwks`}, // eslint-disable-line camelcase
      '/jwks': {keys: [publicJwk]},
    }
    const body = routes[req.url]
    res.writeHead(body ? 200 : 404, {'Content-Type': 'application/json'})
    res.end(JSON.stringify(body ?? {}))
  })
  await new Promise(resolve => {
    server.listen(0, '127.0.0.1', resolve)
  })
  const issuer = `http://127.0.0.1:${server.address().port}`

  const sign = ({claims, signingKey = providerKeys.privateKey, alg = ALG}) =>
    new SignJWT(claims).setProtectedHeader({alg, kid: KID}).sign(signingKey)

  const signIdToken = ({sub, claims = {}, ...signOptions}) => {
    const iat = nowInSeconds()
    return sign({
      claims: {iss: issuer, aud: FAKE_CLIENT_ID, sub, iat, exp: iat + 60, acr: 'eidas1', amr: ['pwd'], ...claims},
      ...signOptions,
    })
  }

  const signUserinfo = ({sub, siret, claims = {}, ...signOptions}) => sign({
    claims: {
      iss: issuer,
      aud: FAKE_CLIENT_ID,
      sub,
      email: `${sub}@example.test`,
      siret,
      given_name: 'Camille', // eslint-disable-line camelcase
      usual_name: 'Test', // eslint-disable-line camelcase
      ...claims,
    },
    ...signOptions,
  })

  const createTokens = async ({sub, siret}) => ({
    idToken: await signIdToken({sub}),
    userinfo: await signUserinfo({sub, siret}),
  })

  const close = () => new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve())
  })

  return {
    url: issuer,
    clientId: FAKE_CLIENT_ID,
    foreignKey: foreignKeys.privateKey,
    signIdToken,
    signUserinfo,
    createTokens,
    close,
  }
}

const hmacSecret = new TextEncoder().encode('integration-test-shared-secret-of-32-bytes')

// Each case returns a pair the API must refuse; `build` receives the running fake provider and an identity.
export const invalidTokenCases = [
  {
    name: 'expired id_token',
    build: async ({provider, sub, siret}) => ({
      idToken: await provider.signIdToken({sub, claims: {iat: nowInSeconds() - 7200, exp: nowInSeconds() - 3600}}),
      userinfo: await provider.signUserinfo({sub, siret}),
    }),
  },
  {
    name: 'id_token for another audience',
    build: async ({provider, sub, siret}) => ({
      idToken: await provider.signIdToken({sub, claims: {aud: 'another-client'}}),
      userinfo: await provider.signUserinfo({sub, siret}),
    }),
  },
  {
    name: 'id_token from another issuer',
    build: async ({provider, sub, siret}) => ({
      idToken: await provider.signIdToken({sub, claims: {iss: 'https://issuer.example.test'}}),
      userinfo: await provider.signUserinfo({sub, siret}),
    }),
  },
  {
    name: 'id_token signed by a foreign key under the provider kid',
    build: async ({provider, sub, siret}) => ({
      idToken: await provider.signIdToken({sub, signingKey: provider.foreignKey}),
      userinfo: await provider.signUserinfo({sub, siret}),
    }),
  },
  {
    name: 'id_token signed with HS256',
    build: async ({provider, sub, siret}) => ({
      idToken: await provider.signIdToken({sub, signingKey: hmacSecret, alg: 'HS256'}),
      userinfo: await provider.signUserinfo({sub, siret}),
    }),
  },
  {
    name: 'userinfo signed by a foreign key',
    build: async ({provider, sub, siret}) => ({
      idToken: await provider.signIdToken({sub}),
      userinfo: await provider.signUserinfo({sub, siret, signingKey: provider.foreignKey}),
    }),
  },
  {
    name: 'userinfo for another sub',
    build: async ({provider, sub, siret}) => ({
      idToken: await provider.signIdToken({sub}),
      userinfo: await provider.signUserinfo({sub: `${sub}-other`, siret}),
    }),
  },
  {
    name: 'userinfo without siret',
    build: async ({provider, sub}) => ({
      idToken: await provider.signIdToken({sub}),
      userinfo: await provider.signUserinfo({sub, siret: undefined}),
    }),
  },
]
