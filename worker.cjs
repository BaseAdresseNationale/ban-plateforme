#!/usr/bin/env node
require('dotenv').config()

const ms = require('ms')
const mongo = require('./lib/util/mongo.cjs')
const queue = require('./lib/util/queue.cjs')

async function main() {
  await mongo.connect()

  // Legacy
  queue('compose-commune').process(2, require('./lib/jobs/compose-commune.cjs'))
  queue('compute-ban-stats').process(1, require('./lib/jobs/compute-ban-stats.cjs'))
  queue('compute-ban-stats').add({}, {repeat: {every: ms('15m')}, removeOnComplete: true})

  // BanID
  queue('address').process(1, require('./lib/api/address/consumers.cjs'))
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
