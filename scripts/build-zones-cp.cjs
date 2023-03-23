#!/usr/bin/env node
require('dotenv').config()
const {join} = require('path')
const {Transform} = require('stream')
const {compact} = require('lodash')
const getStream = require('get-stream')
const {outputJson} = require('fs-extra')
const {featureCollection, convex, point} = require('@turf/turf')
const mongo = require('../lib/util/mongo.cjs')

async function main() {
  await mongo.connect()

  const zones = await getStream.array(
    mongo.db.collection('numeros').aggregate([
      {$match: {'position.coordinates': {$exists: true}, codePostal: {$exists: true}}},
      {$group: {_id: '$codePostal', numeros: {$addToSet: '$position.coordinates'}}}
    ], {allowDiskUse: true}).stream().pipe(new Transform({
      objectMode: true,
      transform(result, enc, cb) {
        const {_id: codePostal, numeros} = result
        const fc = featureCollection(numeros.map(c => point(c)))
        const zone = convex(fc)

        if (!zone) {
          console.log(`Impossible de créer une enveloppe convexe pour le code postal ${codePostal} (${numeros.length} numéros)`)
          return cb()
        }

        zone.properties = {
          codePostal,
          nbNumeros: numeros.length
        }

        cb(null, zone)
      }
    }))
  )

  await outputJson(join(__dirname, '..', 'zones-cp.geojson'), featureCollection(compact(zones)))
  await mongo.disconnect()
  process.exit(0)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
