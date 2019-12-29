#!/usr/bin/env node
require('dotenv').config()
const {join} = require('path')
const {getDepartements} = require('../util/cli')
const {runInParallel} = require('../util/parallel')

const DIST_PATH = join(__dirname, '..', '..', 'dist')

const DISTRIBUTIONS = ['csv', 'addok', 'ndjson']

async function main() {
  const departements = getDepartements()
  const [productName, distName] = process.argv.slice(2)

  if (!distName || !productName || !DISTRIBUTIONS.includes(distName)) {
    console.error('La commande doit être appelée avec le nom du produit et le format de sortie.')
    process.exit(1)
  }

  await runInParallel(
    require.resolve('.'),
    departements.map(departement => ({
      departement,
      distName,
      productName,
      outputPath: join(DIST_PATH, productName, distName)
    }))
  )

  process.exit(0)
}

main()
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
