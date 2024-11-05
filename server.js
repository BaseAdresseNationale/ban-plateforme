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

async function main() {
  // Mongo DB : connecting and creating indexes
  await mongo.connect()

  // Postgres DB : Testing connection and syncing models
  await init()

  // Redis : Configuring memory settings
  await configureRedis()

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
    console.log(`Server is listening on port ${port}`)
  })
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
