const {promisify} = require('util')
const zlib = require('zlib')
const express = require('express')
const geojsonVt = require('geojson-vt')
const vtpbf = require('vt-pbf')
const {featureCollection} = require('@turf/turf')
const {getPopulatedVoie, getPopulatedNumero, getPopulatedCommune, getTileFeatures} = require('../models/commune')
const w = require('../util/w')

const gzip = promisify(zlib.gzip)

const app = new express.Router()

app.get('/lookup/:id', w(async (req, res) => {
  const {id} = req.params

  /* Commune */
  if (id.length === 5) {
    const commune = await getPopulatedCommune(id)

    if (!commune) {
      return res.status(404).send({code: 404, message: 'La commune n’existe pas'})
    }

    return res.send(commune)
  }

  /* Voie */
  if (id.length === 10 || id.length === 12) {
    const voie = await getPopulatedVoie(id)

    if (!voie) {
      return res.status(404).send({code: 404, message: 'La voie n’existe pas'})
    }

    return res.send(voie)
  }

  /* Numéro */
  if (id.length >= 16) {
    const numero = await getPopulatedNumero(id)

    if (!numero) {
      return res.status(404).send({code: 404, message: 'Le numéro n’existe pas'})
    }

    return res.send(numero)
  }

  res.status(400).send({code: 400, message: 'Type d’identifiant inconnu'})
}))

app.get('/tiles/ban/:z/:x/:y', w(async (req, res) => {
  const x = Number.parseInt(req.params.x, 10)
  const y = Number.parseInt(req.params.y, 10)
  const z = Number.parseInt(req.params.z, 10)

  if (z !== 12) {
    return res.sendStatus(404)
  }

  const features = await getTileFeatures(z, x, y)
  const tileIndex = geojsonVt(featureCollection(features), {maxZoom: 12, indexMaxZoom: 12})

  const tile = vtpbf.fromGeojsonVt({adresses: tileIndex.getTile(z, x, y)})

  res.set({
    'Content-Type': 'application/x-protobuf',
    'Content-Encoding': 'gzip'
  })

  const pbf = Buffer.from(tile)

  res.send(await gzip(pbf))
}))

module.exports = app
