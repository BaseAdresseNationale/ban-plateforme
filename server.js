#!/usr/bin/env
require('dotenv').config()

const express = require('express')
const morgan = require('morgan')
const cors = require('cors')
const mongo = require('./lib/util/mongo')

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

  app.use('/', require('./lib/api/routes'))

  const port = process.env.PORT || 5000

  app.listen(port, () => {
    console.log(`Server is listening on port ${port}`)
  })
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
