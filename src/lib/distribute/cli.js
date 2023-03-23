#!/usr/bin/env node
require('dotenv').config()
const {getDepartements} = require('../util/cli')
const {runInParallel} = require('../util/parallel')

const DISTRIBUTIONS = ['csv', 'csv-bal', 'addok', 'geojson']

async function main() {
  const departements = getDepartements()
  const [distName] = process.argv.slice(2)

  if (distName && !DISTRIBUTIONS.includes(distName)) {
    console.error('Le format de sortie demandé n’existe pas.')
    process.exit(1)
  }

  await runInParallel(
    require.resolve('.'),
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
