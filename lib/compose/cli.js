#!/usr/bin/env node
require('dotenv').config()
const {getCommunes} = require('../util/cli')
const {runInParallel} = require('../util/parallel')

async function main() {
  const communes = getCommunes()

  await runInParallel(
    require.resolve('.'),
    communes.map(codeCommune => ({codeCommune})),
    {maxWorkerMemory: 3072}
  )
}

main()
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
