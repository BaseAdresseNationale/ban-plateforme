const {promisify} = require('util')
const {join} = require('path')
const {createWriteStream} = require('fs')
const {createGzip} = require('zlib')
const finished = promisify(require('stream').finished)
const communes = require('@etalab/decoupage-administratif/data/communes.json')
  .filter(c => ['commune-actuelle', 'arrondissement-municipal'].includes(c.type))
const departements = require('@etalab/decoupage-administratif/data/departements.json')
const regions = require('@etalab/decoupage-administratif/data/regions.json')
const {ensureDir} = require('fs-extra')
const {stringify} = require('ndjson')
const pumpify = require('pumpify')
const {chain, memoize, keyBy, uniq, fromPairs, compact} = require('lodash')
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
  const importance = (Math.log(1 + (populationCommune / 3)) + Math.log(1 + nombreNumerosVoie)) / 20
  return parseFloat(importance.toFixed(5))
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
  const duplicateSlugs = chain(adresses)
    .uniqBy('groupId')
    .countBy(a => slugify(a.nomVoie))
    .toPairs()
    .filter(([, count]) => count > 1)
    .map(([slug]) => slug)
    .value()

  const municipality = buildMunicipality(communesIndex[adresses[0].codeCommune], adresses)

  return chain(adresses)
    .groupBy('groupId')
    .map(adressesVoie => {
      const slug = slugify(adressesVoie[0].nomVoie)
      return buildStreet(adressesVoie, duplicateSlugs.includes(slug))
    })
    .value()
    .concat([municipality])
}

function buildStreet(adressesVoie, forceAddOldCity = false) {
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

  return {
    id: voie.cleInterop.split('_').slice(0, 2).join('_'),
    type: 'street',
    lon,
    lat,
    x,
    y,
    importance: buildImportance(commune.population, adressesVoie.length),
    housenumbers,

    ...computeCommonVoieProps(voie, forceAddOldCity)
  }
}

function computeCommonVoieProps(voie, forceAddOldCity = false) {
  const commune = communesIndex[voie.codeCommune]
  const codeCommuneArrondissement = getPLMCodeCommune(commune.code)

  return {
    id: voie.idVoie,
    name: forceAddOldCity && voie.nomAncienneCommune ? `${beautify(voie.nomVoie)} (${voie.nomAncienneCommune})` : beautify(voie.nomVoie),
    postcode: voie.codePostal,
    citycode: codeCommuneArrondissement ? [commune.code, codeCommuneArrondissement] : compact([commune.code, voie.codeAncienneCommune]),
    oldcitycode: voie.codeAncienneCommune,
    lon: voie.lon,
    lat: voie.lat,
    x: voie.x,
    y: voie.y,
    city: compact([getNomCommune(codeCommuneArrondissement), commune.nom, voie.nomAncienneCommune]),
    district: codeCommuneArrondissement ? commune.nom : undefined,
    oldcity: voie.nomAncienneCommune,
    context: buildContext(getCodeDepartement(commune.code)),
    importance: buildImportance(commune.population, 1)
  }
}

function buildLocalities(lieuxDits) {
  return lieuxDits.map(ld => buildLocality(ld))
}

function buildLocality(lieuDit) {
  const commune = communesIndex[lieuDit.codeCommune]

  return {
    type: 'locality',
    importance: buildImportance(commune.population, 1),

    ...computeCommonVoieProps(lieuDit, true)
  }
}

async function expandCommunesWithCenter(codeDepartement) {
  const response = await got(`https://geo.api.gouv.fr/departements/${codeDepartement}/communes?fields=centre`, {json: true})

  response.body.forEach(commune => {
    communesIndex[commune.code].centre = commune.centre
  })
}

function waitForDrain(stream) {
  if (stream.writableLength > stream.writableHighWaterMark) {
    return new Promise(resolve => stream.once('drain', resolve))
  }
}

async function createWriter(outputPath, departement) {
  await ensureDir(outputPath)

  const adressesFile = createWriteStream(join(outputPath, `adresses-addok-${departement}.ndjson.gz`))
  const adressesStream = pumpify.obj(
    stringify(),
    createGzip(),
    adressesFile
  )

  const communesWithAdresses = []

  return {
    async writeAdresses(rawAdresses) {
      if (rawAdresses.length === 0) {
        return
      }

      const {codeCommune} = rawAdresses[0]

      const adresses = rawAdresses.filter(a => a.numero && a.lon && a.lat)
      const lieuxDits = rawAdresses.filter(a => a.type === 'lieu-dit' && a.lon && a.lat)

      if (adresses.length > 0) {
        communesWithAdresses.push(codeCommune)
        buildStreets(adresses).forEach(a => adressesStream.write(a))
      }

      buildLocalities(lieuxDits).forEach(a => adressesStream.write(a))

      await waitForDrain(adressesStream)
    },

    async finish() {
      communes
        .filter(c => c.departement === departement && !communesWithAdresses.includes(c.code))
        .map(commune => buildMunicipality(commune))
        .forEach(a => adressesStream.write(a))

      adressesStream.end()
      await finished(adressesFile)
    }
  }
}

module.exports = {createWriter, buildContext, expandCommunesWithCenter}
