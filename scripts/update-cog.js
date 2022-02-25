#!/usr/bin/env node
/* eslint no-await-in-loop: off */
const mongo = require('../lib/util/mongo')
const {getCommune} = require('../lib/util/cog')
const {deleteCommune, askCompositionAll} = require('../lib/models/commune')

async function main() {
  await mongo.connect()

  const codesCommunesBAN = await mongo.db.collection('communes').distinct('codeCommune')
  const obsoleteCodes = codesCommunesBAN.filter(c => !getCommune(c))

  for (const codeCommune of obsoleteCodes) {
    console.log(`Suppression de la commune ${codeCommune}`)
    await deleteCommune(codeCommune)
  }

  await askCompositionAll()

  await mongo.disconnect()
  process.exit(0)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
