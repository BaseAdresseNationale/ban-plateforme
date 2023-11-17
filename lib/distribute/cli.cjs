#!/usr/bin/env node
require('dotenv').config()
const {getDepartements} = require('../util/cli.cjs')
const {runInParallel} = require('../util/parallel.cjs')

const DISTRIBUTIONS = ['csv', 'csv-bal', 'addok', 'geojson', 'csv-with-ids']

async function main() {
  const departements = getDepartements()
  const [distName] = process.argv.slice(2)

  if (distName && !DISTRIBUTIONS.includes(distName)) {
    console.error('Le format de sortie demandé n’existe pas.')
    process.exit(1)
  }

  await runInParallel(
    require.resolve('./index.cjs'),
    departements.map(departement => ({
      departement,
      distributions: distName ? [distName] : DISTRIBUTIONS
    }))
  )

  process.exit(0)
}

main()
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
