#!/usr/bin/env node
require('dotenv').config()
const argv = require('minimist')(process.argv.slice(2))
const mongo = require('../util/mongo.cjs')
const {getAskedComposition} = require('../models/commune.cjs')
const {runInParallel} = require('../util/parallel.cjs')

async function main() {
  await mongo.connect()
  const commune = argv._[0] ? String(argv._[0]) : undefined // Convert to string if not undefined
  const communes = commune ? [commune] : await getAskedComposition()

  // Check if --forceWithBanId flag is provided
  const forceWithBanId = argv.forceWithBanId || false

  await runInParallel(
    require.resolve('./worker.cjs'),
    communes.map(codeCommune => ({codeCommune, forceWithBanId})),
    {maxWorkerMemory: 3072, maxRetries: 5}
  )

  await mongo.disconnect()
  process.exit(0)
}

main()
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
