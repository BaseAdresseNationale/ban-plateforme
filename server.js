#!/usr/bin/env
import 'dotenv/config.js' // eslint-disable-line import/no-unassigned-import
import express from 'express'
import morgan from 'morgan'
import cors from 'cors'
import mongo from './lib/util/mongo.cjs'
import {init} from './lib/util/sequelize.js'
import {configureRedis} from './lib/util/redis.cjs'

import apiRoutes from './lib/api/routes.js'
import legacyRoutes from './lib/api/legacy-routes.cjs'

function log(message) {
  console.log(`[server] ${new Date().toISOString()} ${message}`)
}

function maskCredentialsInUrl(url) {
  return url.replace(/:([^@/]+)@/g, ':***@')
}

function buildMongoUrl() {
  const MONGODB_DBNAME = process.env.MONGODB_DBNAME || 'ban'
  const MONGODB_HOST = process.env.MONGODB_HOST || 'localhost'
  const {MONGODB_USER, MONGODB_PASSWORD, MONGODB_URL} = process.env

  if (MONGODB_USER && MONGODB_PASSWORD) {
    return `mongodb+srv://${MONGODB_USER}:${MONGODB_PASSWORD}@${MONGODB_HOST}/${MONGODB_DBNAME}?replicaSet=replicaset&tls=true&authSource=admin&readPreference=primary`
  }

  return MONGODB_URL || 'mongodb://localhost'
}

function buildPostgresUrl() {
  const {
    POSTGRES_BAN_USER,
    POSTGRES_BAN_PASSWORD,
    POSTGRES_DB,
    POSTGRES_URL,
    POSTGRES_PORT = 5432,
    CLOUD_ENV,
  } = process.env

  const ssl = CLOUD_ENV === 'true' ? '?sslmode=require' : ''
  return `postgresql://${POSTGRES_BAN_USER}:${POSTGRES_BAN_PASSWORD}@${POSTGRES_URL}:${POSTGRES_PORT}/${POSTGRES_DB}${ssl}`
}

function logStartupConfig() {
  const {NODE_ENV, CLOUD_ENV, PORT, REDIS_URL} = process.env

  log(`NODE_ENV=${NODE_ENV || 'undefined'}, CLOUD_ENV=${CLOUD_ENV || 'undefined'}, PORT=${PORT || 5000}`)
  log(`MongoDB URL: ${maskCredentialsInUrl(buildMongoUrl())}`)
  log(`Postgres URL: ${maskCredentialsInUrl(buildPostgresUrl())}`)
  log(`Redis URL: ${REDIS_URL ? maskCredentialsInUrl(REDIS_URL) : 'non configuré'}`)
}

async function runStep(step, fn) {
  const startedAt = Date.now()
  log(`${step} — début`)
  try {
    await fn()
    log(`${step} — terminé (+${Date.now() - startedAt}ms)`)
  } catch (error) {
    log(`${step} — échec après ${Date.now() - startedAt}ms: ${error.message}`)
    throw error
  }
}

async function main() {
  const startupStartedAt = Date.now()
  log('Démarrage du serveur')
  logStartupConfig()

  await runStep('1/4 Connexion MongoDB', () => mongo.connect())
  await runStep('2/4 Connexion Postgres', () => init())
  if (process.env.CONFIGURE_REDIS === 'false') {
    log('3/4 Configuration Redis — skipped (CONFIGURE_REDIS=false)')
  } else {
    await runStep('3/4 Configuration Redis', () => configureRedis())
  }

  log('4/4 Initialisation Express')
  const app = express()

  if (process.env.NODE_ENV !== 'production') {
    app.use(morgan('dev'))
  }

  app.use(express.json({limit: '20mb'}))

  app.use(cors({origin: true}))

  app.get('/ping', (req, res) => {
    res.send('pong')
  })

  app.get('/health', (req, res) => {
    res.status(200).json({status: 'ok'})
  })

  app.use('/', legacyRoutes)
  app.use('/api', apiRoutes)

  const port = process.env.PORT || 5000

  app.listen(port, () => {
    log(`Serveur prêt sur le port ${port} (démarrage total: +${Date.now() - startupStartedAt}ms)`)
  })
}

main().catch(error => {
  console.error(`[server] ${new Date().toISOString()} Erreur fatale au démarrage:`, error)
  process.exit(1)
})
