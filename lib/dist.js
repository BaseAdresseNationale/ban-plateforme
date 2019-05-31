const {flatten, compact} = require('lodash')
const {MergeDb} = require('./db')
const {getCodesCommunes} = require('./cog')

async function main({departement, distName, outputPath}) {
  console.log(departement)
  const writeData = require(`./writers/${distName}`)
  const db = new MergeDb('default')

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
