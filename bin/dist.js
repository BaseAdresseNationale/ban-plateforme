#!/usr/bin/env node
require('dotenv').config()
const {resolve} = require('path')
const {getDepartements} = require('../lib/cli/util')
const {runInParallel} = require('../lib/cli/parallel')

const DIST_PATTERNS = {
  'ban-v0': resolve(__dirname, '..', 'dist', 'ban-v0', 'adresses-{departement}.csv.gz'),
  bal: resolve(__dirname, '..', 'dist', 'bal', 'adresses-{departement}.csv.gz'),
  geojson: resolve(__dirname, '..', 'dist', 'geojson', 'adresses-{departement}.geojson.gz'),
  comparison: resolve(__dirname, '..', 'dist', 'comparison', 'adresses-{departement}.csv.gz')
}

async function main() {
  const departements = getDepartements()

  if (!process.env.DIST) {
    throw new Error('Le type de distribution doit être défini (DIST)')
  }

  const distName = process.env.DIST

  await runInParallel(
    require.resolve('../lib/dist'),
    departements.map(departement => ({
      departement,
      distName,
      outputPath: DIST_PATTERNS[distName].replace('{departement}', departement)
    }))
  )
}

main()
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
