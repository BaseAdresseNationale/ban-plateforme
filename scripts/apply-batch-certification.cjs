#!/usr/bin/env node
require('dotenv').config()

const path = require('path')
const fs = require('fs-extra')
const mongo = require('../lib/util/mongo.cjs')
const {readCsv} = require('../lib/util/csv.cjs')
const {updateCommunesForceCertification} = require('../lib/models/commune.cjs')

async function main() {
  await mongo.connect()

  const filePath = path.join(__dirname, '..', 'communes-certifiees.csv')
  const file = await fs.readFile(filePath)
  const communes = await readCsv(file, {delimiter: ','})
  const codesCommunesCertifiees = communes.map(c => c.code_insee)
  const {communesAdded, communesRemoved} = await updateCommunesForceCertification(codesCommunesCertifiees)

  console.log('Nouvelles communes certifiées d’office :')
  communesAdded.forEach(c => console.log(` - ${c}`))
  console.log()

  console.log('Communes certifiées d’office supprimées :')
  communesRemoved.forEach(c => console.log(` - ${c}`))

  await mongo.disconnect()
  process.exit(0)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
