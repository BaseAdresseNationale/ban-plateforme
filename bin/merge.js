#!/usr/bin/env node
require('dotenv').config()
const {outputJson} = require('fs-extra')
const {getCommunes} = require('../lib/cli/util')
const {runInParallel} = require('../lib/cli/parallel')

async function main() {
  const communes = getCommunes()

  if (!process.env.SOURCES) {
    throw new Error('La liste des sources à prendre en compte doit être définie (SOURCES)')
  }

  const sources = process.env.SOURCES.split(',')
  const licences = process.env.LICENCES ? process.env.LICENCES.split(',') : undefined

  const communesStats = await runInParallel(
    require.resolve('../lib/merge'),
    communes.map(codeCommune => ({codeCommune, sources, licences})),
    {maxWorkerMemory: 3072}
  )

  await outputJson('db/merge-default/stats.json', communesStats)
}

main()
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
