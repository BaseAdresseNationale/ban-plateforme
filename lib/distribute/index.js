const debug = require('debug')('adresse-pipeline')
const {CommunesDb} = require('../util/storage')
const {getCodesCommunes} = require('../util/cog')

async function main({departement, distName, productName, outputPath}) {
  debug(`département ${departement}`)
  const {writeData} = require(`./writers/${distName}`)
  const db = new CommunesDb(`composition-${productName}`)

  const departementAdresses = []
  const departementLieuxDits = []

  await Promise.all(getCodesCommunes(departement).map(async codeCommune => {
    const communeData = await db.getCommune(codeCommune)

    if (!communeData) {
      return
    }

    const {adresses, lieuxDits} = communeData

    departementAdresses.push(...adresses)
    departementLieuxDits.push(...lieuxDits)
  }))

  await writeData(outputPath, {
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
