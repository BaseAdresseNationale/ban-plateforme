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
const {chain, memoize, keyBy, uniq, fromPairs, groupBy, compact} = require('lodash')
const {center, point, featureCollection, truncate, feature} = require('@turf/turf')
const proj = require('@etalab/project-legal')
const {beautify, slugify} = require('@etalab/adresses-util')
const got = require('got')
const {getCodeDepartement, getPLMCodeCommune, getNomCommune} = require('../../util/cog')

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

function buildCenterProps(adresses) {
  const centerFeature = center(featureCollection(Object.values(adresses).map(({lon, lat}) => point([lon, lat]))))
  const [lon, lat] = truncate(centerFeature).geometry.coordinates
  const [x, y] = proj([lon, lat]) || []
  return {lon, lat, x, y}
}

function getCenterProps(commune, adresses) {
  if (adresses.length > 0) {
    return buildCenterProps(adresses)
  }

  if (commune.centre) {
    const [lon, lat] = truncate(feature(commune.centre)).geometry.coordinates
    const [x, y] = proj([lon, lat])
    return {lon, lat, x, y}
  }

  return {}
}

function buildMunicipality(commune, adresses = []) {
  const centerProps = getCenterProps(commune, adresses)

  return {
    id: commune.code,
    type: 'municipality',
    name: commune.nom,
    postcode: commune.codesPostaux,
    citycode: commune.code,
    ...centerProps,
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

  const municipality = buildMunicipality(communesIndex[adressesCommune[0].codeCommune], adressesCommune)

  return chain(adressesCommune)
    .groupBy('groupId')
    .map(adressesVoie => {
      const slug = slugify(adressesVoie[0].nomVoie)
      return buildStreet(adressesVoie, duplicateSlugs.includes(slug))
    })
    .value()
    .concat([municipality])
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

  const {lon, lat, x, y} = buildCenterProps(adressesVoie)

  const codeCommuneArrondissement = getPLMCodeCommune(commune.code)

  return {
    id: voie.cleInterop.split('_').slice(0, 2).join('_'),
    type: 'street',
    name: addOldCity && voie.nomAncienneCommune ? `${beautify(voie.nomVoie)} (${voie.nomAncienneCommune})` : beautify(voie.nomVoie),
    postcode: voie.codePostal,
    citycode: codeCommuneArrondissement ? [commune.code, codeCommuneArrondissement] : compact([commune.code, voie.codeAncienneCommune]),
    oldcitycode: voie.codeAncienneCommune,
    lon,
    lat,
    x,
    y,
    city: compact([getNomCommune(codeCommuneArrondissement), commune.nom, voie.nomAncienneCommune]),
    district: codeCommuneArrondissement ? commune.nom : undefined,
    oldcity: voie.nomAncienneCommune,
    context: buildContext(getCodeDepartement(commune.code)),
    importance: buildImportance(commune.population, adressesVoie.length),
    housenumbers
  }
}

async function expandCommunesWithCenter(codeDepartement) {
  const response = await got(`https://geo.api.gouv.fr/departements/${codeDepartement}/communes?fields=centre`, {json: true})

  response.body.forEach(commune => {
    communesIndex[commune.code].centre = commune.centre
  })
}

async function writeData(path, {adresses}) {
  const codeDepartement = getCodeDepartement(adresses[0].codeCommune)
  await expandCommunesWithCenter(codeDepartement)
  const filteredAdresses = adresses.filter(a => a.lon && a.lat)

  const adressesCommunes = groupBy(filteredAdresses, 'codeCommune')
  const missingCommunes = communes.filter(c => c.departement === codeDepartement && !(c.code in adressesCommunes))

  await ensureFile(path)
  const steps = [
    intoStream.object(
      missingCommunes.map(commune => buildMunicipality(commune))
        .concat(buildStreets(filteredAdresses))
    ),
    stringify()
  ]
  if (path.endsWith('.gz')) {
    steps.push(createGzip())
  }

  steps.push(createWriteStream(path))
  await pipeline(...steps)
}

module.exports = {writeData, buildContext, expandCommunesWithCenter}
