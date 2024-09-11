#!/usr/bin/env node
require('dotenv').config()

const fs = require('fs');
const fsPromises = fs.promises;
const bluebird = require('bluebird')
const {chain, compact, snakeCase, mapKeys} = require('lodash')
const Papa = require('papaparse')
const {getCommuneData} = require('@etalab/majic')
const {getCommunes} = require('../lib/util/cog.cjs')
function getEnv(name) {
    let val = process.env[name];
    if ((val === undefined) || (val === null)) {
        throw Error("missing env var for " + name);
    }
    return val;
}
const YEAR_MAJIC = getEnv('YEAR_MAJIC')

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
  const communesLocaux = await bluebird.map(getCommunes(), async commune => {
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

  // Update manually https://www.data.gouv.fr/fr/datasets/nombre-de-locaux-adressables-par-communes/
  // with below files

  await fsPromises.writeFile(
    `communes-locaux-adresses-${YEAR_MAJIC}.json`,
    JSON.stringify(communesLocauxCompact)
  )

  await fsPromises.writeFile(
    `communes-locaux-adresses-${YEAR_MAJIC}.csv`,
    Papa.unparse(communesLocauxCompact.map(c => mapKeys(c, (v, k) => snakeCase(k))))
  )
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
