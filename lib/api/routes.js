const express = require('express')
const {getPopulatedVoie, getPopulatedNumero, getPopulatedCommune} = require('../models/commune')
const w = require('../util/w')

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

module.exports = app
