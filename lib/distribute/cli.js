#!/usr/bin/env node
require('dotenv').config()
const {resolve} = require('path')
const {getDepartements} = require('../util/cli')
const {runInParallel} = require('../util/parallel')

const DIST_PATH = resolve(__dirname, '..', '..', 'dist')

const DIST_PATTERNS = {
  'ban-v0': resolve(DIST_PATH, 'ban-v0', 'adresses-{departement}.csv.gz'),
  bal: resolve(DIST_PATH, 'bal', 'adresses-{departement}.csv.gz'),
  geojson: resolve(DIST_PATH, 'geojson', 'adresses-{departement}.geojson.gz')
}

async function main() {
  const departements = getDepartements()

  if (!process.env.DIST) {
    throw new Error('Le type de distribution doit être défini (DIST)')
  }

  const distName = process.env.DIST

  await runInParallel(
    require.resolve('.'),
    departements.map(departement => ({
      departement,
      distName,
      outputPath: DIST_PATTERNS[distName].replace('{departement}', departement)
    }))
  )

  process.exit(0)
}

main()
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
