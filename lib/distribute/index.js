const {flatten, compact} = require('lodash')
const debug = require('debug')('adresse-pipeline')
const {CommunesDb} = require('../util/storage')
const {getCodesCommunes} = require('../util/cog')

async function main({departement, distName, productName, outputPath}) {
  debug(`département ${departement}`)
  const {writeData} = require(`./writers/${distName}`)
  const db = new CommunesDb(`composition-${productName}`)

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
