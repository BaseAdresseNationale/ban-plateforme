const {join} = require('path')
const debug = require('debug')('adresse-pipeline')
const bluebird = require('bluebird')
const {getCommuneData} = require('../models/commune')
const {getCodesCommunes} = require('../util/cog')
const mongo = require('../util/mongo')

const DIST_PATH = join(__dirname, '..', '..', 'dist')

async function main({departement, distributions}) {
  await mongo.connect()

  debug(`département ${departement}`)
  const writers = await Promise.all(distributions.map(distName => {
    const {createWriter} = require(`./writers/${distName}`)
    return createWriter(join(DIST_PATH, distName), departement)
  }))

  await bluebird.map(getCodesCommunes(departement), async codeCommune => {
    const {voies, numeros} = await getCommuneData(codeCommune)
    await bluebird.mapSeries(writers, writer => writer.writeAdresses({voies, numeros}))
  }, {concurrency: 4})

  await Promise.all(writers.map(writer => writer.finish()))
}

module.exports = async function (options, cb) {
  try {
    await main(options)
    cb()
  } catch (error) {
    console.error(error)
    cb(error)
  }
}
