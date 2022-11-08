const express = require('express')
const Papa = require('papaparse')
const {snakeCase, mapKeys} = require('lodash')
const {getCommune, getCommuneData, getPopulatedVoie, getPopulatedNumero, getPopulatedCommune, getAdressesFeatures, getToponymesFeatures, getCommunesSummary} = require('../models/commune')
const Metric = require('../models/metric')
const {prepareAdresses: prepareAdressesLegacy, prepareLieuxDits} = require('../formatters/csv-legacy')
const {prepareAdresses: prepareAdressesBal, extractHeaders} = require('../formatters/csv-bal')
const w = require('../util/w')
const serveMvt = require('../util/serve-mvt')
const Commune = require('../models/commune')

const {ADMIN_TOKEN} = process.env

function ensureIsAdmin(req, res, next) {
  if (!ADMIN_TOKEN) {
    return res.status(401).send({code: 401, message: 'Aucun jeton d’administration n’a été défini'})
  }

  if (req.get('Authorization') !== `Token ${ADMIN_TOKEN}`) {
    return res.status(401).send({code: 401, message: 'Vous n’êtes pas autorisé à effectuer cette action'})
  }

  next()
}

const app = new express.Router()

app.param('codeCommune', w(async (req, res, next) => {
  const {codeCommune} = req.params
  const commune = await getCommune(codeCommune)

  if (!commune) {
    return res.status(404).send({code: 404, message: 'Commune non présente dans la BAN'})
  }

  req.commune = commune
  next()
}))

app.get('/ban/communes/:codeCommune/download/csv-legacy/adresses', w(async (req, res) => {
  const {codeCommune} = req.params
  const {voies, numeros} = await getCommuneData(codeCommune)
  const adresses = prepareAdressesLegacy({voies, numeros})
  const csvFile = Papa.unparse(adresses, {delimiter: ';'})

  res
    .attachment(`adresses-${codeCommune}.csv`)
    .type('text/csv')
    .send(csvFile)
}))

app.get('/ban/communes/:codeCommune/download/csv-legacy/lieux-dits', w(async (req, res) => {
  const {codeCommune} = req.params
  const {voies} = await getCommuneData(codeCommune)
  const lieuxDits = prepareLieuxDits({voies})
  const csvFile = Papa.unparse(lieuxDits, {delimiter: ';'})

  res
    .attachment(`lieux-dits-${codeCommune}.csv`)
    .type('text/csv')
    .send(csvFile)
}))

app.post('/ban/communes/:codeCommune/compose', ensureIsAdmin, w(async (req, res) => {
  const {codeCommune} = req.commune
  const {force} = req.body?.options || {force: false}

  await Commune.askComposition(req.commune.codeCommune, {force})
  const commune = await getCommune(codeCommune)

  return res.send(commune)
}))

app.get('/ban/communes/:codeCommune/download/csv-bal/adresses', w(async (req, res) => {
  const {codeCommune} = req.params
  const {voies, numeros} = await getCommuneData(codeCommune)
  const adresses = prepareAdressesBal({voies, numeros}, true)
  const headers = extractHeaders(adresses)
  const csvFile = Papa.unparse(adresses, {
    delimiter: ';',
    header: true,
    columns: headers
  })

  res
    .attachment(`adresses-${codeCommune}.csv`)
    .type('text/csv')
    .send(csvFile)
}))

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
    'id_revision',
    'date_revision',
    'type_composition',
    'nb_lieux_dits',
    'nb_voies',
    'nb_numeros',
    'nb_numeros_certifies',
    'analyse_adressage_nb_adresses_attendues',
    'analyse_adressage_ratio',
    'analyse_adressage_deficit_adresses',
    'composed_at'
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

app.get('/ban/stats', w(async (req, res) => {
  const metric = await Metric.getLastMetric('ban-stats')
  res.send(metric.value)
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
