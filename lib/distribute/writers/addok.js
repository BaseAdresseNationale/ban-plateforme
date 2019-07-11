const {promisify} = require('util')
const {createWriteStream} = require('fs')
const {createGzip} = require('zlib')
const pipeline = promisify(require('stream').pipeline)
const communes = require('@etalab/decoupage-administratif/data/communes.json')
  .filter(c => ['commune-actuelle', 'arrondissement-municipal'].includes(c.type))
const departements = require('@etalab/decoupage-administratif/data/departements.json')
const regions = require('@etalab/decoupage-administratif/data/regions.json')
const {ensureFile} = require('fs-extra')
const intoStream = require('into-stream')
const {stringify} = require('ndjson')
const {chain, memoize, keyBy, uniq, fromPairs} = require('lodash')
const {center, point, featureCollection, truncate} = require('@turf/turf')
const proj = require('@etalab/project-legal')
const {beautify, slugify} = require('@etalab/adresses-util')
const {getCodeDepartement} = require('../../util/cog')

const communesIndex = keyBy(communes, 'code')
const departementsIndex = keyBy(departements, 'code')
const regionsIndex = keyBy(regions, 'code')

const buildContext = memoize(codeDepartement => {
  const departement = departementsIndex[codeDepartement]
  const region = regionsIndex[departement.region]
  return uniq([codeDepartement, departement.nom, region.nom]).join(', ')
})

function buildImportance(populationCommune = 0, nombreNumerosVoie = 0) {
  return (Math.log(1 + (populationCommune / 3)) + Math.log(1 + nombreNumerosVoie)) / 20
}

function buildMunicipalities(codeDepartement) {
  return communes.filter(c => c.departement === codeDepartement).map(buildMunicipality)
}

function buildMunicipality(commune) {
  return {
    id: commune.code,
    type: 'municipality',
    name: commune.nom,
    postcode: commune.codesPostaux,
    citycode: commune.code,
    lon: null,
    lat: null,
    x: null,
    y: null,
    population: commune.population,
    city: commune.nom,
    context: buildContext(getCodeDepartement(commune.code)),
    importance: buildImportance(commune.population)
  }
}

function buildStreets(adresses) {
  return chain(adresses).groupBy('codeCommune').map(buildCommuneStreets).flatten().value()
}

function buildCommuneStreets(adressesCommune) {
  const duplicateSlugs = chain(adressesCommune)
    .uniqBy('groupId')
    .countBy(a => slugify(a.nomVoie))
    .toPairs()
    .filter(([, count]) => count > 1)
    .map(([slug]) => slug)
    .value()

  return chain(adressesCommune)
    .groupBy('groupId')
    .map(adressesVoie => {
      const slug = slugify(adressesVoie[0].nomVoie)
      return buildStreet(adressesVoie, duplicateSlugs.includes(slug))
    })
    .value()
}

function buildStreet(adressesVoie, addOldCity = false) {
  const [voie] = adressesVoie
  const commune = communesIndex[voie.codeCommune]
  const housenumbers = fromPairs(adressesVoie.map(adresse => {
    return [
      [adresse.numero, adresse.suffixe].filter(Boolean).join(' '),
      {
        id: adresse.cleInterop,
        x: adresse.x,
        y: adresse.y,
        lon: adresse.lon,
        lat: adresse.lat
      }
    ]
  }))

  const centerFeature = center(featureCollection(Object.values(housenumbers).map(({lon, lat}) => point([lon, lat]))))
  const [lon, lat] = truncate(centerFeature).geometry.coordinates
  const [x, y] = proj([lon, lat])

  return {
    id: voie.cleInterop.split('_').slice(0, 2).join('_'),
    type: 'street',
    name: addOldCity && voie.nomAncienneCommune ? `${beautify(voie.nomVoie)} (${voie.nomAncienneCommune})` : beautify(voie.nomVoie),
    postcode: voie.codePostal,
    citycode: commune.code,
    lon,
    lat,
    x,
    y,
    city: commune.nom,
    context: buildContext(getCodeDepartement(commune.code)),
    importance: buildImportance(commune.population, adressesVoie.length),
    housenumbers
  }
}

async function writeData(path, adresses) {
  const {codeCommune} = adresses[0]
  const codeDepartement = getCodeDepartement(codeCommune)

  await ensureFile(path)
  const steps = [
    intoStream.object(
      buildMunicipalities(codeDepartement)
        .concat(buildStreets(adresses))
    ),
    stringify()
  ]
  if (path.endsWith('.gz')) {
    steps.push(createGzip())
  }

  steps.push(createWriteStream(path))
  await pipeline(...steps)
}

module.exports = {writeData, buildContext}
