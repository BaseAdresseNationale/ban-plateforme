const express = require('express')
const Papa = require('papaparse')
const {snakeCase, mapKeys} = require('lodash')
const {getPopulatedVoie, getPopulatedNumero, getPopulatedCommune, getAdressesFeatures, getToponymesFeatures, getCommunesSummary} = require('../models/commune')
const w = require('../util/w')
const serveMvt = require('../util/serve-mvt')

const app = new express.Router()

app.get('/api/communes-summary', w(async (req, res) => {
  const communesSummary = await getCommunesSummary()
  res.send(communesSummary)
}))

app.get('/api/communes-summary.csv', w(async (req, res) => {
  const communesSummary = (await getCommunesSummary()).map(c => {
    const s = {...c}

    /* eslint camelcase: off */
    if (c.analyseAdressage) {
      s.analyse_adressage_nb_adresses_attendues = c.analyseAdressage.nbAdressesAttendues || ''
      s.analyse_adressage_ratio = 'ratio' in c.analyseAdressage ? c.analyseAdressage.ratio : ''
      s.analyse_adressage_deficit_adresses = 'deficitAdresses' in c.analyseAdressage
        ? (c.analyseAdressage.deficitAdresses ? '1' : '0')
        : ''
    }

    return s
  })

  const columns = [
    'region',
    'departement',
    'code_commune',
    'nom_commune',
    'population',
    'type_composition',
    'nb_lieux_dits',
    'nb_voies',
    'nb_numeros',
    'analyse_adressage_nb_adresses_attendues',
    'analyse_adressage_ratio',
    'analyse_adressage_deficit_adresses'
  ]
  const csv = Papa.unparse(communesSummary.map(c => mapKeys(c, (v, k) => snakeCase(k))), {columns})
  res.type('csv').send(csv)
}))

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

app.get('/tiles/ban/:z/:x/:y.pbf', w(async (req, res) => {
  req.x = Number.parseInt(req.params.x, 10)
  req.y = Number.parseInt(req.params.y, 10)
  req.z = Number.parseInt(req.params.z, 10)

  if (req.z < 10 || req.z > 14) {
    return res.sendStatus(404)
  }

  const [adresses, toponymes] = await Promise.all([
    getAdressesFeatures(req.z, req.x, req.y),
    getToponymesFeatures(req.z, req.x, req.y)
  ])

  req.layersFeatures = {adresses, toponymes}

  await serveMvt(req, res)
}))

module.exports = app
