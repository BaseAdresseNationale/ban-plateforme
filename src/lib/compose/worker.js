const {finishComposition} = require('../models/commune')
const mongo = require('../util/mongo')
const composeCommune = require('.')

async function main(options) {
  await mongo.connect()
  const {codeCommune} = options

  console.time(`commune ${codeCommune}`)

  await composeCommune(codeCommune)
  await finishComposition(codeCommune)

  console.timeEnd(`commune ${codeCommune}`)
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
