#!/usr/bin/env node
require('dotenv').config()
const {getCommunes} = require('../lib/cli/util')
const {runInParallel} = require('../lib/cli/parallel')

async function main() {
  const communes = getCommunes()

  await runInParallel(
    require.resolve('../lib/compose'),
    communes.map(codeCommune => ({codeCommune})),
    {maxWorkerMemory: 3072}
  )
}

main()
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
