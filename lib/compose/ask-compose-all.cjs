#!/usr/bin/env node
/* eslint no-await-in-loop: off */
require('dotenv').config()
const argv = require('minimist')(process.argv.slice(2), {string: '_'})
const mongo = require('../util/mongo.cjs')
const {askComposition} = require('../models/commune.cjs')
const {getCommunes} = require('../util/cog.cjs')

async function main() {
  const force = argv.force || false
  if (force) {
    console.info('option "force" activée')
  }

  await mongo.connect()

  const codesCommunesBAN = await mongo.db.collection('communes').distinct('codeCommune')
  const currentCodes = new Set(codesCommunesBAN)

  const communes = getCommunes().filter(c => currentCodes.has(c.code))
  console.log(`Communes à composer: ${communes.length}`)

  for (const commune of communes) {
    await askComposition(commune.code, {force})
  }

  console.log('Composition France entière demandée')
  console.log('Faire un `yarn compose` pour lancer la composition')
  await mongo.disconnect()
  process.exit(0)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
