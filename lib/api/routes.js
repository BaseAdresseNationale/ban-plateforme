const express = require('express')
const {getPopulatedVoie, getPopulatedNumero, getPopulatedCommune, getTileFeatures} = require('../models/commune')
const w = require('../util/w')
const serveMvt = require('../util/serve-mvt')

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
  req.x = Number.parseInt(req.params.x, 10)
  req.y = Number.parseInt(req.params.y, 10)
  req.z = Number.parseInt(req.params.z, 10)

  if (req.z < 12 || req.z > 14) {
    return res.sendStatus(404)
  }

  req.layersFeatures = {
    adresses: await getTileFeatures(req.z, req.x, req.y)
  }

  await serveMvt(req, res)
}))

module.exports = app
