const {countBy, compact} = require('lodash')
const debug = require('debug')('adresse-pipeline')
const {outputJson} = require('fs-extra')
const {CommunesDb} = require('../util/storage')
const {getCodesCommunes} = require('../cog')
const {getCommuneFeature} = require('./geojson')

function computeRatios(data) {
  if (data.total) {
    Object.assign(data, {
      'ban-lo-only-ratio': (data['ban-lo-only'] || 0) / data.total,
      'ban-v0-only-ratio': (data['ban-v0-only'] || 0) / data.total,
      ecart: ((data['ban-v0-only'] || 0) - (data['ban-lo-only'] || 0)) / data.total
    })
  } else {
    Object.assign(data, {
      'ban-lo-only-ratio': null,
      'ban-v0-only-ratio': null,
      ecart: null
    })
  }
}

async function buildCommune(codeCommune, db) {
  const [adresses, feature] = await Promise.all([
    db.getCommune(codeCommune),
    getCommuneFeature(codeCommune)
  ])

  if (!feature) {
    return
  }

  const counts = countBy(adresses || [], ({sources, numero}) => {
    if (sources.length === 1 && sources[0] === 'ban-v0') {
      return 'ban-v0-only'
    }

    const parsedNumero = Number.parseInt(numero, 10)
    if (parsedNumero > 5000) {
      return 'pseudo-adresse'
    }

    if (!sources.includes('ban-v0')) {
      return 'ban-lo-only'
    }

    return 'both'
  })

  Object.assign(feature.properties, {
    'ban-lo-only': counts['ban-lo-only'] || 0,
    'ban-v0-only': counts['ban-v0-only'] || 0,
    'pseudo-adresse': counts['pseudo-adresse'] || 0,
    both: counts.both || 0,
    total: (counts.both || 0) + (counts['ban-lo-only'] || 0) + (counts['ban-v0-only'] || 0)
  })
  computeRatios(feature.properties)

  return feature
}

async function main({departement, outputPath}) {
  debug(`département ${departement}`)
  const db = new CommunesDb('merge-default')

  const features = compact(
    await Promise.all(getCodesCommunes(departement).map(codeCommune => buildCommune(codeCommune, db)))
  )

  const metrics = features.reduce((acc, f) => {
    acc.total += (f.properties.total || 0)
    acc['ban-lo-only'] += (f.properties['ban-lo-only'] || 0)
    acc['pseudo-adresse'] += (f.properties['pseudo-adresse'] || 0)
    acc['ban-v0-only'] += (f.properties['ban-v0-only'] || 0)
    acc.both += (f.properties.both || 0)
    return acc
  }, {departement, total: 0, 'ban-lo-only': 0, 'ban-v0-only': 0, both: 0, 'pseudo-adresse': 0})
  computeRatios(metrics)

  await outputJson(outputPath, {type: 'FeatureCollection', features})

  return metrics
}

module.exports = async function (options, cb) {
  try {
    const result = await main(options)
    cb(null, result)
  } catch (error) {
    console.error(error)
    cb(error)
  }
}
