#!/usr/bin/env node
require('dotenv').config()
const {outputJson} = require('fs-extra')
const mongo = require('../util/mongo')
const {getAskedComposition} = require('../models/commune')
const {runInParallel} = require('../util/parallel')

async function main() {
  await mongo.connect()
  const communes = await getAskedComposition()

  const communesStats = await runInParallel(
    require.resolve('.'),
    communes.map(codeCommune => ({codeCommune})),
    {maxWorkerMemory: 3072, maxRetries: 5}
  )

  await outputJson('db/composition-default/stats.json', communesStats)
  await mongo.disconnect()
}

main()
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
