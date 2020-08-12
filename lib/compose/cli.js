#!/usr/bin/env node
require('dotenv').config()
const {outputJson} = require('fs-extra')
const {getCommunes} = require('../util/cli')
const {runInParallel} = require('../util/parallel')

async function main() {
  const communes = getCommunes()

  const communesStats = await runInParallel(
    require.resolve('.'),
    communes.map(codeCommune => ({codeCommune})),
    {maxWorkerMemory: 3072}
  )

  await outputJson('db/compose-default/stats.json', communesStats)
}

main()
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
