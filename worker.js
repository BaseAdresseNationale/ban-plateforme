#!/usr/bin/env node

import 'dotenv/config.js' // eslint-disable-line import/no-unassigned-import
import ms from 'ms'

import apiConsumer from './lib/api/consumers/api-consumer.js'
import exportToExploitationDBConsumer from './lib/api/consumers/export-to-exploitation-db-consumer.js'
import cleanJobStatusConsumer from './lib/api/consumers/clean-job-status-consumer.js'
import buildReportsConsumer from './lib/api/consumers/build-reports.js'

import mongo from './lib/util/mongo.cjs'
import queue from './lib/util/queue.cjs'
import composeCommune from './lib/jobs/compose-commune.cjs'
import computeBanStats from './lib/jobs/compute-ban-stats.cjs'
import balGarbageCollector from './lib/compose/bal-garbage-collector/index.js'
import {init} from './lib/util/sequelize.js'

async function main() {
  // Mongo DB : connecting and creating indexes
  await mongo.connect()

  // Postgres DB : Testing connection and syncing models
  await init()

  if (process.env.NODE_ENV === 'production') {
    // Garbage collector
    await balGarbageCollector()
  }

  // Legacy
  queue('compose-commune').process(4, composeCommune)
  queue('compute-ban-stats').process(1, computeBanStats)
  queue('compute-ban-stats').add({}, {jobId: 'computeBanStatsJobId', repeat: {every: ms('15m')}, removeOnComplete: true})

  // BanID
  queue('api').process(1, apiConsumer)
  queue('export-to-exploitation-db').process(1, exportToExploitationDBConsumer)
  queue('clean-job-status').process(1, cleanJobStatusConsumer)
  queue('clean-job-status').add({}, {jobId: 'cleanJobStatusJobId', repeat: {every: ms('1d')}, removeOnComplete: true})
  queue('build-reports').process(1, buildReportsConsumer)
  queue('build-reports').add({}, {jobId: 'buildReportsJobId', repeat: {every: ms('1d')}, removeOnComplete: true})
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
