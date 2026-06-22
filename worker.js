#!/usr/bin/env node

import 'dotenv/config.js' // eslint-disable-line import/no-unassigned-import
import ms from 'ms'

import apiConsumer from './lib/api/consumers/api-consumer.js'
import exportToExploitationDBConsumer from './lib/api/consumers/export-to-exploitation-db-consumer.js'
import cleanJobStatusConsumer from './lib/api/consumers/clean-job-status-consumer.js'

import mongo from './lib/util/mongo.cjs'
import {redis} from './lib/util/redis.cjs'
import queue from './lib/util/queue.cjs'
import composeCommune from './lib/jobs/compose-commune.cjs'
import computeBanStats from './lib/jobs/compute-ban-stats.cjs'
import balGarbageCollector from './lib/compose/bal-garbage-collector/index.js'
import {init, sequelize} from './lib/util/sequelize.js'
import {addOrUpdateJob} from './lib/api/helper.js'

const COMPOSE_CONCURRENCY = Number(process.env.COMPOSE_CONCURRENCY) || 4
const API_CONCURRENCY = Number(process.env.API_QUEUE_CONCURRENCY) || 1
const EXPORT_CONCURRENCY = Number(process.env.EXPORT_QUEUE_CONCURRENCY) || 1

const allQueues = [
  queue('compose-commune'),
  queue('compute-ban-stats'),
  queue('api'),
  queue('export-to-exploitation-db'),
  queue('clean-job-status'),
  queue('bal-garbage-collector'),
]

const shutdown = async signal => {
  console.log(`[worker] ${signal} reçu — fermeture propre`)
  await Promise.all(allQueues.map(q => q.close()))
  await mongo.disconnect()
  await sequelize.close()
  process.exit(0)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

async function main() {
  await mongo.connect()
  await init()

  // GC au boot : lock leader (TTL 600s) → un seul worker l'exécute au démarrage
  if (process.env.NODE_ENV === 'production') {
    try {
      const gcLock = await redis.set('worker:leader:gc', '1', 'NX', 'EX', 600)
      if (gcLock === 'OK') {
        await balGarbageCollector()
      } else {
        console.log('[worker] GC boot skipped — un autre worker est leader')
      }
    } catch (error) {
      console.warn('[worker] Redis indisponible, GC boot skipped:', error.message)
    }
  }

  // Enregistrement des crons : lock 24h → un seul worker (leader scheduler)
  let isSchedulerLeader = false
  try {
    const schedulerLock = await redis.set('worker:leader:scheduler', '1', 'NX', 'EX', 86_400)
    if (schedulerLock === 'OK') {
      isSchedulerLeader = true
      queue('compute-ban-stats').add({}, {jobId: 'computeBanStatsJobId', repeat: {every: ms('2h')}, removeOnComplete: true})
      queue('clean-job-status').add({}, {jobId: 'cleanJobStatusJobId', repeat: {every: ms('1d')}, removeOnComplete: true})
      queue('bal-garbage-collector').add({}, {jobId: 'balGarbageCollectorJobId', repeat: {every: ms('1d')}, removeOnComplete: true})
      console.log('[worker] Leader scheduler — crons enregistrés (ban-stats toutes les 2h)')
    }
  } catch (error) {
    console.warn('[worker] Redis indisponible pour le lock scheduler, enregistrement des crons quand même:', error.message)
    queue('compute-ban-stats').add({}, {jobId: 'computeBanStatsJobId', repeat: {every: ms('2h')}, removeOnComplete: true})
    queue('clean-job-status').add({}, {jobId: 'cleanJobStatusJobId', repeat: {every: ms('1d')}, removeOnComplete: true})
    queue('bal-garbage-collector').add({}, {jobId: 'balGarbageCollectorJobId', repeat: {every: ms('1d')}, removeOnComplete: true})
  }

  // Recovery optionnelle après crash Valkey confirmé (RECOVERY_SCAN_ON_BOOT=true)
  if (process.env.RECOVERY_SCAN_ON_BOOT === 'true') {
    await runRecoveryScan()
  }

  // Tous les workers consomment api / compose / export ; crons lourds sur le leader uniquement
  queue('compose-commune').process(COMPOSE_CONCURRENCY, composeCommune)
  if (isSchedulerLeader) {
    queue('compute-ban-stats').process(1, computeBanStats)
  } else {
    console.log('[worker] compute-ban-stats skipped — pas leader scheduler')
  }

  queue('api').process(API_CONCURRENCY, apiConsumer)
  queue('export-to-exploitation-db').process(EXPORT_CONCURRENCY, exportToExploitationDBConsumer)
  queue('clean-job-status').process(1, cleanJobStatusConsumer)
  queue('bal-garbage-collector').process(1, async () => {
    await balGarbageCollector()
  })
}

async function runRecoveryScan() {
  try {
    const recoveryLock = await redis.set('worker:leader:recovery', '1', 'NX', 'EX', 3600)
    if (recoveryLock !== 'OK') {
      return
    }

    const oneDayAgo = new Date(Date.now() - (24 * 60 * 60 * 1000))
    const rows = await sequelize.query(
      `SELECT DISTINCT "districtID" FROM ban."Address" WHERE "updateDate" > :cutoff
       UNION
       SELECT DISTINCT "districtID" FROM ban."CommonToponym" WHERE "updateDate" > :cutoff`,
      {replacements: {cutoff: oneDayAgo}, type: sequelize.QueryTypes.SELECT}
    )

    if (rows.length > 0) {
      console.log(`[worker] Recovery: re-queue export pour ${rows.length} districts récemment modifiés`)
      for (const {districtID} of rows) {
        await addOrUpdateJob(queue('export-to-exploitation-db'), districtID, 0) // eslint-disable-line no-await-in-loop
      }
    }

    console.log('[worker] Recovery scan terminé. Penser à repasser RECOVERY_SCAN_ON_BOOT=false.')
  } catch (error) {
    console.warn('[worker] Recovery scan failed:', error.message)
  }
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
