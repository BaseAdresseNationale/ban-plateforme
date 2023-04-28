#!/usr/bin/env node

import 'dotenv/config.js' // eslint-disable-line import/no-unassigned-import
import ms from 'ms'

import apiConsumer from './lib/api/consumers/api-consumer.js'

import mongo from './lib/util/mongo.cjs'
import queue from './lib/util/queue.cjs'
import composeCommune from './lib/jobs/compose-commune.cjs'
import computeBanStats from './lib/jobs/compute-ban-stats.cjs'
import balGarbageCollector from './lib/compose/bal-garbage-collector/index.js'

async function main() {
  await mongo.connect()

  if (process.env.NODE_ENV === 'production') {
    // Garbage collector
    await balGarbageCollector()
  }

  // Legacy
  queue('compose-commune').process(2, composeCommune)
  queue('compute-ban-stats').process(1, computeBanStats)
  queue('compute-ban-stats').add({}, {repeat: {every: ms('15m')}, removeOnComplete: true})

  // BanID
  queue('api').process(1, apiConsumer)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
