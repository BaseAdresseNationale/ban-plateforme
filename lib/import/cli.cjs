#!/usr/bin/env node
require('dotenv').config()
const mongo = require('../util/mongo.cjs')
const {getDepartements} = require('../util/cli.cjs')
const {runInParallel} = require('../util/parallel.cjs')

async function main() {
  await mongo.connect()

  const [sourceName] = process.argv.slice(2)

  if (!sourceName) {
    throw new Error('La commande appelée doit indiquer le nom de la source à importer.')
  }

  await runInParallel(
    require.resolve('./index.cjs'),
    getDepartements().map(part => ({part, sourceName})),
    {maxWorkerMemory: 8192, maxConcurrentWorkers: 2}
  )

  process.exit(0)
}

main()
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
