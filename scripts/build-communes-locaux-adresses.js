#!/usr/bin/env node
require('dotenv').config()

const bluebird = require('bluebird')
const {chain, compact, snakeCase, mapKeys} = require('lodash')
const Papa = require('papaparse')
const {getCommuneData} = require('@etalab/majic')
const communes = require('@etalab/decoupage-administratif/data/communes.json')
  .filter(c => ['arrondissement-municipal', 'commune-actuelle'].includes(c.type))
const {replaceResourceFile} = require('../lib/util/datagouv')

const ACCEPTED_CATEGORIES_LOCAUX = new Set([
  'maison',
  'appartement',
  'commerce',
  'port-de-plaisance',
  'site-industriel',
  'gare',
  // Catégories révisées
  'bureaux',
  'depot',
  'atelier-artisanal',
  'atelier-industriel',
  'chenil-vivier',
  'hotel',
  'autre-hebergement',
  'residence-hoteliere',
  'salle-de-spectacle',
  'salle-de-loisir',
  'terrain-de-camping',
  'etablissement-detente-bien-etre',
  'centre-de-loisirs',
  'ecole-privee',
  'hopital',
  'centre-medico-social-creche',
  'maison-de-retraite',
  'centre-thermal-reeducation',
  'autre-etablissement'
])

function eachCommune(commune, locaux) {
  const acceptedLocaux = locaux.filter(l => ACCEPTED_CATEGORIES_LOCAUX.has(l.categorieLocal))
  const nbAdressesLocaux = chain(acceptedLocaux).map(l => `${l.codeVoie}-${l.numero}`).uniq().value().length

  const communeLocaux = {
    codeCommune: commune.code,
    nomCommune: commune.nom,
    population: commune.population,
    nbLocaux: acceptedLocaux.length,
    nbAdressesLocaux
  }

  return communeLocaux
}

async function main() {
  const communesLocaux = await bluebird.map(communes, async commune => {
    const locaux = await getCommuneData(commune.code, {profile: 'simple'})

    if (!locaux || locaux.length === 0) {
      console.log(`Pas de locaux pour ${commune.nom} (${commune.code})`)
      return
    }

    const result = eachCommune(commune, locaux)
    console.log(`${commune.code} ${commune.nom} OK!`)
    return result
  }, {concurrency: 5})

  const communesLocauxCompact = compact(communesLocaux)

  const datasetId = '5fda75d3084b5fa14f89cd2f'

  await replaceResourceFile(
    datasetId,
    '9a4a5188-8142-4c9d-b3e6-f54594848509',
    'communes-locaux-adresses.json',
    JSON.stringify(communesLocauxCompact)
  )

  await replaceResourceFile(
    datasetId,
    '9854b368-abce-479e-80f1-cfdbedaa0232',
    'communes-locaux-adresses.csv',
    Papa.unparse(communesLocauxCompact.map(c => mapKeys(c, (v, k) => snakeCase(k))))
  )
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
