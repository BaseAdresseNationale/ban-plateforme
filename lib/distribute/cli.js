#!/usr/bin/env node
require('dotenv').config()
const {resolve} = require('path')
const {getDepartements} = require('../util/cli')
const {runInParallel} = require('../util/parallel')

const DIST_PATH = resolve(__dirname, '..', '..', 'dist')

const DIST_PATTERNS = {
  csv: resolve(DIST_PATH, 'csv', 'adresses-{departement}.csv.gz'),
  bal: resolve(DIST_PATH, 'bal', 'adresses-{departement}.csv.gz'),
  geojson: resolve(DIST_PATH, 'geojson', 'adresses-{departement}.geojson.gz')
}

async function main() {
  const departements = getDepartements()
  const distName = process.argv.slice(2)[0]

  if (!distName || !(distName in DIST_PATTERNS)) {
    console.error('La commande doit être appelée avec format de sortie.')
    process.exit(1)
  }

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
