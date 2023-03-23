#!/usr/bin/env node
require('dotenv').config()
const mongo = require('../util/mongo.cjs')
const {getAskedComposition} = require('../models/commune.cjs')
const {runInParallel} = require('../util/parallel.cjs')

async function main() {
  await mongo.connect()
  const [commune] = process.argv.slice(2)
  const communes = commune ? [commune] : await getAskedComposition()

  await runInParallel(
    require.resolve('./worker.cjs'),
    communes.map(codeCommune => ({codeCommune})),
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
