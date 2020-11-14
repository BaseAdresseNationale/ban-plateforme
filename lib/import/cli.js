#!/usr/bin/env node
require('dotenv').config()
const mongo = require('../util/mongo')
const {getDepartements, getCommunes} = require('../util/cli')
const {runInParallel} = require('../util/parallel')

function getParts(sourceName) {
  return sourceName === 'insee-ril' ? getCommunes() : getDepartements()
}

async function main() {
  await mongo.connect()

  const sourceName = process.env.SOURCE
  const parts = getParts(sourceName)

  await runInParallel(require.resolve('.'), parts.map(part => ({
    part,
    sourceName
  })))

  process.exit(0)
}

main()
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
