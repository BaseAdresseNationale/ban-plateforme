#!/usr/bin/env node
/* eslint no-await-in-loop: off */
require('dotenv').config()
const mongo = require('../util/mongo.cjs')
const {askComposition} = require('../models/commune.cjs')
const {getCommunes} = require('../util/cog.cjs')

async function main() {
  await mongo.connect()

  const codesCommunesBAN = await mongo.db.collection('communes').distinct('codeCommune')
  const currentCodes = new Set(codesCommunesBAN)

  const communes = getCommunes().filter(c => currentCodes.has(c.code))

  for (const commune of communes) {
    await askComposition(commune.code, {force: true})
  }

  console.log('Composition forcée demandée')
  await mongo.disconnect()
  process.exit(0)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
