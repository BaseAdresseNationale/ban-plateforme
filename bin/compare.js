#!/usr/bin/env node
require('dotenv').config()
const {join} = require('path')
const {outputJson} = require('fs-extra')
const {getDepartements} = require('../lib/cli/util')
const {runInParallel} = require('../lib/cli/parallel')
const {getDepartementFeature} = require('../lib/compare/geojson')

const COMPARE_PATH = join(__dirname, '..', 'dist', 'compare')

async function main() {
  const departements = getDepartements()

  const departementsMetrics = await runInParallel(
    require.resolve('../lib/compare/departement.worker'),
    departements.map(departement => ({
      departement,
      outputPath: join(COMPARE_PATH, 'compare-{departement}.geojson').replace('{departement}', departement)
    }))
  )

  const features = await Promise.all(departementsMetrics.map(async departementMetrics => {
    const feature = await getDepartementFeature(departementMetrics.departement)
    Object.assign(feature.properties, departementMetrics)
    return feature
  }))

  await outputJson(join(COMPARE_PATH, 'compare-france.geojson'), {type: 'FeatureCollection', features})

  process.exit(0)
}

main()
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
