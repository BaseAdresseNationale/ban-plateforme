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

function logStartupConfig() {
  const {
    NODE_ENV,
    CLOUD_ENV,
    PORT,
    MONGODB_HOST,
    MONGODB_DBNAME,
    MONGODB_USER,
    POSTGRES_URL,
    POSTGRES_DB,
    POSTGRES_BAN_USER,
    REDIS_URL,
  } = process.env

  log(`NODE_ENV=${NODE_ENV || 'undefined'}, CLOUD_ENV=${CLOUD_ENV || 'undefined'}, PORT=${PORT || 5000}`)
  log(`MongoDB: host=${MONGODB_HOST || 'localhost'}, db=${MONGODB_DBNAME || 'ban'}, auth=${Boolean(MONGODB_USER)}`)
  log(`Postgres: host=${POSTGRES_URL || 'undefined'}, db=${POSTGRES_DB || 'undefined'}, user=${POSTGRES_BAN_USER || 'undefined'}, ssl=${CLOUD_ENV === 'true'}`)
  log(`Redis: configured=${Boolean(REDIS_URL)}`)
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
  await runStep('3/4 Configuration Redis', () => configureRedis())

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
