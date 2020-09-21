const debug = require('debug')('adresse-pipeline')
const Adresse = require('../models/adresse')
const {getCodesCommunes} = require('../util/cog')
const mongo = require('../util/mongo')

async function main({departement, distName, outputPath}) {
  await mongo.connect()

  debug(`département ${departement}`)
  const {writeData} = require(`./writers/${distName}`)

  const departementAdresses = []
  const departementLieuxDits = []

  await Promise.all(getCodesCommunes(departement).map(async codeCommune => {
    const rawAdresses = await Adresse.getAllByCommune(codeCommune)

    const adresses = rawAdresses.filter(a => a.numero)
    departementAdresses.push(...adresses)
    const lieuxDits = rawAdresses.filter(a => a.type === 'lieu-dit')
    departementLieuxDits.push(...lieuxDits)
  }))

  await writeData({
    outputPath,
    departement,
    adresses: departementAdresses,
    lieuxDits: departementLieuxDits
  })
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
