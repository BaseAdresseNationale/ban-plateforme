#!/usr/bin/env node
require('dotenv').config()
const mongo = require('../util/mongo')
const {getDepartements} = require('../util/cli')
const {runInParallel} = require('../util/parallel')

async function main() {
  await mongo.connect()

  const [sourceName] = process.argv.slice(2)

  if (!sourceName) {
    throw new Error('La commande appelée doit indiquer le nom de la source à importer.')
  }

  await runInParallel(
    require.resolve('.'),
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
