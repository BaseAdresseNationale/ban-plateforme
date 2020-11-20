#!/usr/bin/env node
require('dotenv').config()

const mongo = require('./lib/util/mongo')
const queue = require('./lib/util/queue')

async function main() {
  await mongo.connect()

  queue('compose-commune').process(10, require('./lib/jobs/compose-commune'))
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
