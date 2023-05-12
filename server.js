#!/usr/bin/env
import 'dotenv/config.js' // eslint-disable-line import/no-unassigned-import
import express from 'express'
import morgan from 'morgan'
import cors from 'cors'
import mongo from './lib/util/mongo.cjs'

import addressRoutes from './lib/api/address/routes.js'
import commonToponymRoutes from './lib/api/common-toponym/routes.js'
import districtRoutes from './lib/api/district/routes.js'
import statusRoutes from './lib/api/job-status/routes.js'

import legacyRoutes from './lib/api/legacy-routes.cjs'

async function main() {
  await mongo.connect()

  const app = express()

  if (process.env.NODE_ENV !== 'production') {
    app.use(morgan('dev'))
  }

  app.use(cors({origin: true}))

  app.get('/ping', (req, res) => {
    res.send('pong')
  })

  app.use('/', legacyRoutes)
  app.use('/address', addressRoutes)
  app.use('/common-toponym', commonToponymRoutes)
  app.use('/district', districtRoutes)
  app.use('/job-status', statusRoutes)

  const port = process.env.PORT || 5000

  app.listen(port, () => {
    console.log(`Server is listening on port ${port}`)
  })
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
