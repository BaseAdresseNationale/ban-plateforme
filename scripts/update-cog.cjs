#!/usr/bin/env node
/* eslint no-await-in-loop: off */
require('dotenv').config()
const mongo = require('../lib/util/mongo.cjs')
const {getCommune, getCommunes} = require('../lib/util/cog.cjs')
const {deleteCommune, askComposition, askCompositionAll} = require('../lib/models/commune.cjs')

async function main() {
  await mongo.connect()

  const codesCommunesBAN = await mongo.db.collection('communes').distinct('codeCommune')
  const currentCodes = new Set(codesCommunesBAN)

  const missingCommunes = getCommunes().filter(c => !currentCodes.has(c.code))

  for (const missingCommune of missingCommunes) {
    console.log(`Création de la commune ${missingCommune.code}`)
    await askComposition(missingCommune.code, {force: true})
  }

  const obsoleteCodes = codesCommunesBAN.filter(c => !getCommune(c))

  for (const codeCommune of obsoleteCodes) {
    console.log(`Suppression de la commune ${codeCommune}`)
    await deleteCommune(codeCommune)
  }

  if (obsoleteCodes.length > 0) {
    await askCompositionAll()
  }

  await mongo.disconnect()
  process.exit(0)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
