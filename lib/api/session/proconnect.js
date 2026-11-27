import {createRemoteJWKSet, jwtVerify} from 'jose'
import {getProConnectClientId, getProConnectProviderUrl} from './config.js'

// ProConnect signs with an asymmetric key; HS256 would need the client secret, which the API does not hold.
const ALLOWED_ALGORITHMS = ['RS256', 'ES256']
const DISCOVERY_TIMEOUT_MS = 5000

// Errors that mean "these tokens are not valid", as opposed to a provider or network failure (500).
const VERIFICATION_ERROR_CODES = new Set([
  'ERR_JWT_CLAIM_VALIDATION_FAILED',
  'ERR_JWT_EXPIRED',
  'ERR_JWT_INVALID',
  'ERR_JWS_INVALID',
  'ERR_JWS_SIGNATURE_VERIFICATION_FAILED',
  'ERR_JOSE_ALG_NOT_ALLOWED',
  'ERR_JOSE_NOT_SUPPORTED',
  'ERR_JWKS_NO_MATCHING_KEY',
  'ERR_JWKS_MULTIPLE_MATCHING_KEYS',
])

export class ProConnectVerificationError extends Error {
  constructor(message) {
    super(message)
    this.name = 'ProConnectVerificationError'
  }
}

let providerMemo

const discoverProvider = async providerUrl => {
  const discoveryUrl = `${providerUrl.replace(/\/+$/, '')}/.well-known/openid-configuration`
  const response = await fetch(discoveryUrl, {signal: AbortSignal.timeout(DISCOVERY_TIMEOUT_MS)})
  if (!response.ok) {
    throw new Error(`ProConnect discovery failed with status ${response.status}`)
  }

  const {issuer, jwks_uri: jwksUri} = await response.json()
  if (!issuer || !jwksUri) {
    throw new Error('ProConnect discovery document lacks issuer or jwks_uri')
  }

  // The key set is cached by jose and refetched on an unknown kid, which covers key rotation.
  return {issuer, jwks: createRemoteJWKSet(new URL(jwksUri))}
}

const getProvider = providerUrl => {
  if (providerMemo?.providerUrl !== providerUrl) {
    const promise = discoverProvider(providerUrl)
    providerMemo = {providerUrl, promise}
    promise.catch(() => {
      if (providerMemo?.promise === promise) {
        providerMemo = undefined
      }
    })
  }

  return providerMemo.promise
}

const verifyJwt = async ({jwt, jwks, options}) => {
  try {
    const {payload} = await jwtVerify(jwt, jwks, {algorithms: ALLOWED_ALGORITHMS, ...options})
    return payload
  } catch (error) {
    if (VERIFICATION_ERROR_CODES.has(error.code)) {
      throw new ProConnectVerificationError(error.message)
    }

    throw error
  }
}

const normalizeAmr = amr => {
  if (amr === undefined || amr === null) {
    return null
  }

  return Array.isArray(amr) ? amr.map(String) : [String(amr)]
}

export const verifyProConnectTokens = async ({idToken, userinfo}) => {
  const providerUrl = getProConnectProviderUrl()
  const clientId = getProConnectClientId()
  if (!providerUrl || !clientId) {
    throw new Error('PROCONNECT_PROVIDER_URL and PROCONNECT_CLIENT_ID must be set to create sessions')
  }

  const {issuer, jwks} = await getProvider(providerUrl)

  const idClaims = await verifyJwt({
    jwt: idToken,
    jwks,
    options: {issuer, audience: clientId, requiredClaims: ['sub', 'exp', 'iat']},
  })
  const userClaims = await verifyJwt({jwt: userinfo, jwks, options: {issuer, audience: clientId}})

  if (userClaims.sub !== idClaims.sub) {
    throw new ProConnectVerificationError('userinfo sub does not match the id_token sub')
  }

  if (!userClaims.email || !userClaims.siret) {
    throw new ProConnectVerificationError('userinfo lacks email or siret')
  }

  return {
    sub: idClaims.sub,
    email: userClaims.email,
    siret: userClaims.siret,
    givenName: userClaims.given_name,
    usualName: userClaims.usual_name,
    familyName: userClaims.family_name,
    name: userClaims.name,
    acr: idClaims.acr ?? null,
    amr: normalizeAmr(idClaims.amr),
    aud: clientId,
    exp: idClaims.exp,
    iat: idClaims.iat,
    iss: idClaims.iss,
  }
}
