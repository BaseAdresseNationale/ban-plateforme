#!/usr/bin/env node
require('dotenv').config()
const {outputJson} = require('fs-extra')
const {getCommunes} = require('../util/cli')
const {runInParallel} = require('../util/parallel')

async function main() {
  const communes = getCommunes()

  if (!process.env.MERGE_INPUT_SOURCES) {
    throw new Error('La liste des fichiers sources à prendre en compte doit être définie (MERGE_INPUT_SOURCES)')
  }

  if (!process.env.MERGE_FILTER_SOURCES) {
    throw new Error('La liste des sources à prendre en compte doit être définie (MERGE_FILTER_SOURCES)')
  }

  const inputSources = process.env.MERGE_INPUT_SOURCES.split(',')
  const filterSources = process.env.MERGE_FILTER_SOURCES.split(',')
  const licences = process.env.LICENCES ? process.env.LICENCES.split(',') : undefined

  const communesStats = await runInParallel(
    require.resolve('.'),
    communes.map(codeCommune => ({codeCommune, inputSources, filterSources, licences})),
    {maxWorkerMemory: 3072}
  )

  await outputJson('db/merge-default/stats.json', communesStats)
}

main()
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
