const {flatten, compact} = require('lodash')
const debug = require('debug')('adresse-pipeline')
const {CommunesDb} = require('./db')
const {getCodesCommunes} = require('./cog')

async function main({departement, distName, outputPath}) {
  debug(`département ${departement}`)
  const writeData = require(`./writers/${distName}`)
  const db = new CommunesDb('merge-default')

  const adresses = flatten(compact(
    await Promise.all(getCodesCommunes(departement).map(codeCommune => db.getCommune(codeCommune)))
  ))

  await writeData(outputPath, adresses)
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
