#!/usr/bin/env node
const {promisify} = require('util')
const pipeline = promisify(require('stream').pipeline)
const {Transform} = require('stream')
const Papa = require('papaparse')
const {chain} = require('lodash')
const mongo = require('../lib/util/mongo')
const {createPseudoCodeVoieGenerator} = require('../lib/pseudo-codes-voies')

async function processCommuneRows(rows) {
  const codeCommune = rows[0].code_insee
  const generator = await createPseudoCodeVoieGenerator(codeCommune)
  let created = 0
  let existing = 0

  chain(rows)
    .uniqBy(r => {
      const [, codeVoie] = r.id.split('_')
      const codeAncienneCommune = r.code_insee_ancienne_commune || '00000'
      return `${codeAncienneCommune}-${codeVoie}`
    })
    .forEach(v => {
      const [, codeVoie] = v.id.split('_')
      const codeAncienneCommune = v.code_insee_ancienne_commune

      if (codeVoie.length !== 6) {
        return
      }

      if (generator.hasCode(codeVoie, codeAncienneCommune)) {
        existing++
      } else {
        generator.setCode(codeVoie, v.nom_voie, codeAncienneCommune)
        created++
      }
    })
    .value()

  await generator.save()

  console.log(`${codeCommune} - Créés : ${created} - Existants : ${existing}`)
}

async function main() {
  await mongo.connect()

  let codeCommune
  let communeRows

  await pipeline(
    process.stdin,
    Papa.parse(Papa.NODE_STREAM_INPUT, {delimiter: ';'}),
    new Transform({
      objectMode: true,
      async transform(row, enc, cb) {
        if (row.code_insee !== codeCommune) {
          if (codeCommune) {
            await processCommuneRows(communeRows)
          }

          codeCommune = row.code_insee
          communeRows = []
        }

        communeRows.push(row)
        cb()
      },
      async flush(cb) {
        if (codeCommune) {
          await processCommuneRows(communeRows)
        }

        cb()
      }
    })
  )
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
