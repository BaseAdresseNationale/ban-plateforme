#!/usr/bin/env node
require('dotenv').config()
const {outputJson} = require('fs-extra')
const {getCommunes} = require('../util/cli')
const {runInParallel} = require('../util/parallel')

async function main() {
  const communes = getCommunes()

  const inputSources = [
    'ign-api-gestion',
    'cadastre',
    'ftth',
    'bal'
  ]

  const filterSources = [
    'ign-api-gestion-ign',
    'ign-api-gestion-laposte',
    'ign-api-gestion-sdis',
    'ign-api-gestion-municipal_administration',
    'cadastre',
    'ftth',
    'bal'
  ]

  const communesStats = await runInParallel(
    require.resolve('.'),
    communes.map(codeCommune => ({codeCommune, inputSources, filterSources})),
    {maxWorkerMemory: 3072}
  )

  await outputJson('db/merge-default/stats.json', communesStats)
}

main()
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
