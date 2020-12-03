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
const {chain, memoize, groupBy, keyBy, uniq, fromPairs, compact} = require('lodash')
const {center, point, featureCollection, truncate, feature} = require('@turf/turf')

const {beautify, slugify} = require('@etalab/adresses-util')
const got = require('got')
const {harmlessProj} = require('../../util/proj')
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

function buildCenterProps(numeros) {
  const centerFeature = center(featureCollection(Object.values(numeros).map(({lon, lat}) => point([lon, lat]))))
  const [lon, lat] = truncate(centerFeature).geometry.coordinates
  const [x, y] = harmlessProj([lon, lat]) || []
  return {lon, lat, x, y}
}

function getCenterProps(commune, numeros) {
  if (numeros.length > 0) {
    return buildCenterProps(numeros)
  }

  if (commune.centre) {
    const [lon, lat] = truncate(feature(commune.centre)).geometry.coordinates
    const [x, y] = harmlessProj([lon, lat])
    return {lon, lat, x, y}
  }

  return {}
}

function buildMunicipality(commune, numeros = []) {
  const centerProps = getCenterProps(commune, numeros)

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

function buildStreet(voie, forceAddOldCity = false) {
  const commune = communesIndex[voie.codeCommune]
  const housenumbers = fromPairs(voie.numeros.map(numero => {
    return [
      [numero.numero, numero.suffixe].filter(Boolean).join(' '),
      {
        id: numero.cleInterop,
        x: numero.x,
        y: numero.y,
        lon: numero.lon,
        lat: numero.lat
      }
    ]
  }))

  const {lon, lat, x, y} = buildCenterProps(voie.numeros)

  return {
    id: voie.idVoie,
    type: 'street',
    lon,
    lat,
    x,
    y,
    importance: buildImportance(commune.population, voie.numeros.length),
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

function buildLocality(lieuDit) {
  const commune = communesIndex[lieuDit.codeCommune]

  return {
    type: 'locality',
    importance: buildImportance(commune.population, 1),

    ...computeCommonVoieProps(lieuDit, true)
  }
}

async function expandCommunesWithCenter(codeDepartement) {
  const response = await got(`https://geo.api.gouv.fr/departements/${codeDepartement}/communes?fields=centre`, {responseType: 'json'})

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
  await expandCommunesWithCenter(departement)

  const adressesFile = createWriteStream(join(outputPath, `adresses-addok-${departement}.ndjson.gz`))
  const adressesStream = pumpify.obj(
    stringify(),
    createGzip(),
    adressesFile
  )

  const communesWithAdresses = []

  return {
    async writeAdresses({voies, numeros}) {
      if (voies.length === 0) {
        return
      }

      const {codeCommune} = voies[0]
      const commune = communesIndex[codeCommune]

      voies.filter(a => a.type === 'lieu-dit' && a.lon && a.lat).forEach(lieuDit => {
        adressesStream.write(buildLocality(lieuDit))
      })

      const numerosGeolocalises = groupBy(numeros.filter(n => n.lon && n.lat), 'idVoie')

      const voiesAvecNumeros = voies
        .filter(v => v.idVoie in numerosGeolocalises && v.type === 'voie')
        .map(v => ({...v, numeros: numerosGeolocalises[v.idVoie]}))

      if (voiesAvecNumeros.length > 0) {
        adressesStream.write(buildMunicipality(commune, voiesAvecNumeros.numeros))
        communesWithAdresses.push(codeCommune)

        const duplicateSlugs = chain(voiesAvecNumeros)
          .countBy(a => slugify(a.nomVoie))
          .toPairs()
          .filter(([, count]) => count > 1)
          .map(([slug]) => slug)
          .value()

        voiesAvecNumeros.forEach(voie => {
          const slug = slugify(voie.nomVoie)
          const street = buildStreet(voie, duplicateSlugs.includes(slug))
          adressesStream.write(street)
        })
      }

      await waitForDrain(adressesStream)
    },

    async finish() {
      communes
        .filter(c => c.departement === departement && !communesWithAdresses.includes(c.code))
        .forEach(commune => adressesStream.write(buildMunicipality(commune)))

      adressesStream.end()
      await finished(adressesFile)
    }
  }
}

module.exports = {createWriter, buildContext, expandCommunesWithCenter}
