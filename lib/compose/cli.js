#!/usr/bin/env node
require('dotenv').config()
const {getCommunes} = require('../util/cli')
const {runInParallel} = require('../util/parallel')

const PRODUCTS = [
  'adresses-lo',
  'adresses-odbl',
  'bal-cadastre-ftth-ril-guichet'
]

async function main() {
  const communes = getCommunes()
  const productName = process.argv.slice(2)[0]

  if (!productName || !PRODUCTS.includes(productName)) {
    console.error('La commande doit être appelée avec un nom de produit connu.')
    process.exit(1)
  }

  console.log(`Préparation de ${productName}`)

  await runInParallel(
    require.resolve('.'),
    communes.map(codeCommune => ({codeCommune, productName})),
    {maxWorkerMemory: 3072}
  )
}

main()
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
