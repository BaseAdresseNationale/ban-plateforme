#!/usr/bin/env node
require('dotenv').config()
const {resolve} = require('path')
const {SourceDb} = require('../util/storage')
const {getDepartements, getCommunes} = require('../util/cli')
const {runInParallel} = require('../util/parallel')

const SOURCES_PATTERNS = {
  'ban-v0': process.env.BANV0_PATH_PATTERN && resolve(process.env.BANV0_PATH_PATTERN),
  bal: process.env.BAL_PATH_PATTERN && resolve(process.env.BAL_PATH_PATTERN),
  cadastre: process.env.CADASTRE_PATH_PATTERN && resolve(process.env.CADASTRE_PATH_PATTERN),
  ftth: process.env.FTTH_PATH_PATTERN && resolve(process.env.FTTH_PATH_PATTERN),
  'ign-api-gestion': process.env.IGN_API_GESTION_PATH_PATTERN && resolve(process.env.IGN_API_GESTION_PATH_PATTERN),
  'insee-ril': process.env.INSEE_RIL_PATH_PATTERN && resolve(process.env.INSEE_RIL_PATH_PATTERN)
}

function getIterationType(pathPattern) {
  return pathPattern.includes('{dep}') ? 'dep' : 'commune'
}

function getList(iterationType) {
  return iterationType === 'dep' ? getDepartements() : getCommunes()
}

async function main() {
  const sourceName = process.env.SOURCE
  const sourcePattern = SOURCES_PATTERNS[process.env.SOURCE]
  const iterationType = getIterationType(sourceName)
  const list = getList(iterationType)

  const db = new SourceDb(sourceName)
  await db.clear()

  await runInParallel(require.resolve('.'), list.map(part => ({
    sourceName,
    sourcePath: sourcePattern.replace(`{${iterationType}}`, part)
  })))

  process.exit(0)
}

main()
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
