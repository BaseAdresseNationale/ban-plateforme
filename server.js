#!/usr/bin/env
import dotenv from 'dotenv'

import express from 'express'
import morgan from 'morgan'
import cors from 'cors'
import mongo from './lib/util/mongo.cjs'
import legacyRoutes from './lib/api/routes.cjs'
import routes from './lib/api/address/routes.js'

dotenv.config()

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
  app.use('/address', routes)

  const port = process.env.PORT || 5000

  app.listen(port, () => {
    console.log(`Server is listening on port ${port}`)
  })
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
