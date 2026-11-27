import {randomUUID} from 'node:crypto'
import express from 'express'
import request from 'supertest'
import mongo from '../../util/mongo.cjs'
import queue from '../../util/queue.cjs'
import {sequelize, Session} from '../../util/sequelize.js'
import {BAN_SESSION_HEADER, getSessionAbsoluteDurationMs} from '../session/config.js'
import apiRoutes from '../routes.js'
import {startFakeProConnect} from './fake-proconnect.js'

// Synthetic rows only: fixed ids and owner keys let every run purge what a previous run left behind.
// Every test sub and owner starts with this prefix, so sessions and preferences are purged by it.
const TEST_IDENTITY_PREFIX = 'integration-test-'
export const TEST_COG = '60636'
export const TEST_COMMUNE_SIREN = '216006270'
export const TEST_DISTRICT_ID = 'a0000000-0000-4000-8000-000000000001'
export const TEST_COMMON_TOPONYM_ID = 'a0000000-0000-4000-8000-000000000002'
export const TEST_ADDRESS_ID = 'a0000000-0000-4000-8000-000000000003'

export const COMMUNE_SESSION_SUB = 'integration-test-sub-commune'
export const OTHER_COMMUNE_SESSION_SUB = 'integration-test-sub-other-commune'
export const SESSION_ROUTE_SUB = 'integration-test-sub-session-route'
export const FAVORITES_SESSION_SUB = 'integration-test-sub-favorites'

export const OWNER_ID = 'integration-test-owner'
export const OTHER_OWNER_ID = 'integration-test-other-owner'
const TEST_OWNERS = [OWNER_ID, OTHER_OWNER_ID]

export const COMMUNE_SIRET = '21600627000017'
export const OTHER_COMMUNE_SIRET = '21750001600019'

const externalRowsCreated = {mongoCommune: false, datanova: false}
let previousTokens
let currentToken
let fakeProConnect
const previousProConnectEnv = {}
const PROCONNECT_ENV_NAMES = ['PROCONNECT_PROVIDER_URL', 'PROCONNECT_CLIENT_ID']

export const buildApp = () => {
  const app = express()
  app.use(express.json({limit: '20mb'}))
  app.use('/api', apiRoutes)
  return app
}

export const connectStores = async () => {
  await mongo.connect()
  await sequelize.authenticate()
}

export const closeStores = async () => {
  await sequelize.close()
  await mongo.disconnect()
  await queue('api').close()
  await queue('export-to-exploitation-db').close()
  await queue('compose-commune').close()
}

export const useTestToken = () => {
  previousTokens = process.env.BAN_API_AUTHORIZED_TOKENS
  currentToken = randomUUID()
  process.env.BAN_API_AUTHORIZED_TOKENS = currentToken
  return currentToken
}

export const restoreEnv = ({name, value}) => {
  if (value === undefined) {
    delete process.env[name]
  } else {
    process.env[name] = value
  }
}

export const restoreToken = () => {
  restoreEnv({name: 'BAN_API_AUTHORIZED_TOKENS', value: previousTokens})
}

// Points the API at a local fake ProConnect for the whole test file; closed by tearDown.
export const useFakeProConnect = async () => {
  fakeProConnect = await startFakeProConnect()
  for (const name of PROCONNECT_ENV_NAMES) {
    previousProConnectEnv[name] = process.env[name]
  }

  process.env.PROCONNECT_PROVIDER_URL = fakeProConnect.url
  process.env.PROCONNECT_CLIENT_ID = fakeProConnect.clientId
  return fakeProConnect
}

const stopFakeProConnect = async () => {
  if (!fakeProConnect) {
    return
  }

  for (const name of PROCONNECT_ENV_NAMES) {
    restoreEnv({name, value: previousProConnectEnv[name]})
  }

  await fakeProConnect.close()
  fakeProConnect = undefined
}

// Logs in through POST /api/session with tokens of the fake provider; needs useTestToken and useFakeProConnect.
export const createTestSession = async ({sub, siret}) => {
  const response = await request(buildApp())
    .post('/api/session')
    .set('Authorization', `Token ${currentToken}`)
    .send(await fakeProConnect.createTokens({sub, siret}))

  if (response.status !== 201) {
    throw new Error(`Test session creation failed with status ${response.status}`)
  }

  return response.body.response.sessionId
}

export const sessionHeader = sessionId => ({[BAN_SESSION_HEADER]: sessionId})

export const withLegacyMode = async fn => {
  const previous = process.env.BAN_SESSION_LEGACY_MODE_ENABLED
  process.env.BAN_SESSION_LEGACY_MODE_ENABLED = 'true'
  try {
    return await fn()
  } finally {
    restoreEnv({name: 'BAN_SESSION_LEGACY_MODE_ENABLED', value: previous})
  }
}

export const buildSessionClaims = ({sub, siret}) => {
  const now = Math.floor(Date.now() / 1000)
  return {
    sub,
    email: `${sub}@example.test`,
    siret,
    aud: 'integration-test-client',
    exp: String(now + 3600),
    iat: String(now),
    iss: 'https://proconnect.example.test',
  }
}

// Legacy session row (no tokenHash), as stored by the old mode.
export const insertSession = claims => {
  const now = new Date()
  return Session.create({
    id: randomUUID(),
    ...claims,
    expiresAt: new Date(now.getTime() + getSessionAbsoluteDurationMs()),
    lastSeenAt: now,
    createdAt: now,
    updatedAt: now,
  })
}

export const insertDistrictFixtures = async () => {
  await sequelize.query(
    `INSERT INTO ban.district (id, labels, "updateDate", meta, "isActive")
     VALUES (:id, ARRAY[CAST(:label AS jsonb)], now(), CAST(:meta AS jsonb), true)`,
    {replacements: {
      id: TEST_DISTRICT_ID,
      label: JSON.stringify({isoCode: 'fra', value: 'Integration test district'}),
      meta: JSON.stringify({insee: {cog: TEST_COG}}),
    }}
  )
  await sequelize.query(
    `INSERT INTO ban.common_toponym (id, "districtID", labels, "updateDate", meta, "isActive")
     VALUES (:id, :districtId, ARRAY[CAST(:label AS jsonb)], now(), CAST('{}' AS jsonb), true)`,
    {replacements: {
      id: TEST_COMMON_TOPONYM_ID,
      districtId: TEST_DISTRICT_ID,
      label: JSON.stringify({isoCode: 'fra', value: 'Integration test street'}),
    }}
  )
  await sequelize.query(
    `INSERT INTO ban.address (id, "mainCommonToponymID", "secondaryCommonToponymIDs", "districtID", number, labels, certified, positions, "updateDate", meta, "isActive")
     VALUES (:id, :commonToponymId, ARRAY[]::uuid[], :districtId, 1, ARRAY[]::jsonb[], true, ARRAY[CAST(:position AS jsonb)], now(), CAST(:meta AS jsonb), true)`,
    {replacements: {
      id: TEST_ADDRESS_ID,
      commonToponymId: TEST_COMMON_TOPONYM_ID,
      districtId: TEST_DISTRICT_ID,
      position: JSON.stringify({type: 'entrance', geometry: {type: 'Point', coordinates: [2.88, 49.47]}}),
      meta: JSON.stringify({cadastre: {ids: ['600636000AA0001']}}),
    }}
  )
}

// An UPDATE of ban.district_config writes to ban.district_config_h, which the API user cannot purge: tests delete and reinsert instead.
export const deleteDistrictConfig = () =>
  sequelize.query('DELETE FROM ban.district_config WHERE district_id = :districtId', {replacements: {districtId: TEST_DISTRICT_ID}})

export const setDistrictConfig = async config => {
  await deleteDistrictConfig()
  await sequelize.query(
    `INSERT INTO ban.district_config (district_id, config, "createdAt", "updatedAt")
     VALUES (:districtId, CAST(:config AS jsonb), now(), now())`,
    {replacements: {districtId: TEST_DISTRICT_ID, config: JSON.stringify(config)}}
  )
}

// The enable route reads the Mongo commune, the certificate route reads external.datanova.
export const ensureExternalRows = async () => {
  const communes = mongo.db.collection('communes')
  if (!await communes.findOne({codeCommune: TEST_COG})) {
    await communes.insertOne({codeCommune: TEST_COG, withBanId: true})
    externalRowsCreated.mongoCommune = true
  }

  const [[datanova]] = await sequelize.query('SELECT count(*)::int AS n FROM external.datanova WHERE "inseeCom" = :cog', {replacements: {cog: TEST_COG}})
  if (datanova.n === 0) {
    await sequelize.query(
      `INSERT INTO external.datanova ("inseeCom", "postalCodes", "libelleAcheminementWithPostalCodes", "createdAt", "updatedAt")
       VALUES (:cog, ARRAY['60150'], CAST('{}' AS jsonb), now(), now())`,
      {replacements: {cog: TEST_COG}}
    )
    externalRowsCreated.datanova = true
  }
}

export const purgeFixtures = async () => {
  await sequelize.query('DELETE FROM ban.action WHERE "districtID" = :districtId', {replacements: {districtId: TEST_DISTRICT_ID}})
  await sequelize.query('DELETE FROM ban.certificate WHERE address_id = :addressId', {replacements: {addressId: TEST_ADDRESS_ID}})
  await deleteDistrictConfig()
  await sequelize.query('DELETE FROM ban.address WHERE id = :id', {replacements: {id: TEST_ADDRESS_ID}})
  await sequelize.query('DELETE FROM ban.common_toponym WHERE id = :id', {replacements: {id: TEST_COMMON_TOPONYM_ID}})
  await sequelize.query('DELETE FROM ban.district WHERE id = :id', {replacements: {id: TEST_DISTRICT_ID}})
  await sequelize.query('DELETE FROM ban.session WHERE sub LIKE :prefix', {replacements: {prefix: `${TEST_IDENTITY_PREFIX}%`}})
  await sequelize.query('DELETE FROM ban.user_preferences WHERE id LIKE :prefix', {replacements: {prefix: `${TEST_IDENTITY_PREFIX}%`}})
  await sequelize.query('DELETE FROM ban.subscribers WHERE "createdBy" IN (:owners)', {replacements: {owners: TEST_OWNERS}})

  if (externalRowsCreated.mongoCommune) {
    await mongo.db.collection('communes').deleteOne({codeCommune: TEST_COG})
    externalRowsCreated.mongoCommune = false
  }

  if (externalRowsCreated.datanova) {
    await sequelize.query('DELETE FROM external.datanova WHERE "inseeCom" = :cog', {replacements: {cog: TEST_COG}})
    externalRowsCreated.datanova = false
  }
}

export const tearDown = async () => {
  try {
    await purgeFixtures()
  } finally {
    restoreToken()
    await stopFakeProConnect()
    await closeStores()
  }
}
