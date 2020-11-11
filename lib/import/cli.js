#!/usr/bin/env node
require('dotenv').config()
const {resolve} = require('path')
const source = require('../models/source')
const mongo = require('../util/mongo')
const {getDepartements, getCommunes} = require('../util/cli')
const {runInParallel} = require('../util/parallel')

function eventuallyResolve(path) {
  if (!path.startsWith('http')) {
    return resolve(path)
  }

  return path
}

const SOURCES_PATTERNS = {
  bal: process.env.BAL_PATH_PATTERN ?
    eventuallyResolve(process.env.BAL_PATH_PATTERN) :
    'https://adresse.data.gouv.fr/data/adresses-locales/latest/csv/adresses-locales-{dep}.csv.gz',

  cadastre: process.env.CADASTRE_PATH_PATTERN ?
    eventuallyResolve(process.env.CADASTRE_PATH_PATTERN) :
    'https://adresse.data.gouv.fr/data/adresses-cadastre/latest/ndjson-full/adresses-cadastre-{dep}.ndjson.gz',

  ftth: process.env.FTTH_PATH_PATTERN ?
    eventuallyResolve(process.env.FTTH_PATH_PATTERN) :
    'https://adresse.data.gouv.fr/data/adresses-ftth/latest/geojson/adresses-ftth-{dep}.geojson.gz',

  'ign-api-gestion': process.env.IGN_API_GESTION_PATH_PATTERN ?
    eventuallyResolve(process.env.IGN_API_GESTION_PATH_PATTERN) :
    'https://adresse.data.gouv.fr/data/ban/export-api-gestion/latest/{name}-{dep}.csv.gz',

  'insee-ril': process.env.INSEE_RIL_PATH_PATTERN && eventuallyResolve(process.env.INSEE_RIL_PATH_PATTERN)
}

function getIterationType(pathPattern) {
  return pathPattern.includes('{dep}') ? 'dep' : 'commune'
}

function getList(iterationType) {
  return iterationType === 'dep' ? getDepartements() : getCommunes()
}

async function main() {
  await mongo.connect()

  const sourceName = process.env.SOURCE
  const sourcePattern = SOURCES_PATTERNS[process.env.SOURCE]
  const iterationType = getIterationType(sourcePattern)
  const list = getList(iterationType)

  await source(sourceName).deleteAllAdresses()

  await runInParallel(require.resolve('.'), list.map(part => ({
    part,
    iterationType,
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
