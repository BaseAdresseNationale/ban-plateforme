#!/usr/bin/env node

import dotenv from 'dotenv'
import ms from 'ms'

import addressConsumers from './lib/api/address/consumers.js'

import mongo from './lib/util/mongo.cjs'
import queue from './lib/util/queue.cjs'
import composeCommune from './lib/jobs/compose-commune.cjs'
import computeBanStats from './lib/jobs/compute-ban-stats.cjs'

dotenv.config()

async function main() {
  await mongo.connect()

  // Legacy
  queue('compose-commune').process(2, composeCommune)
  queue('compute-ban-stats').process(1, computeBanStats)
  queue('compute-ban-stats').add({}, {repeat: {every: ms('15m')}, removeOnComplete: true})

  // BanID
  queue('address').process(1, addressConsumers)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
