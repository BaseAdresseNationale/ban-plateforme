const {promisify} = require('util')
const {join} = require('path')
const {createWriteStream} = require('fs')
const {createGzip} = require('zlib')
const finished = promisify(require('stream').finished)
const {ensureDir} = require('fs-extra')
const {stringify} = require('ndjson')
const pumpify = require('pumpify')
const {chain, memoize, groupBy, uniq, fromPairs, compact} = require('lodash')
const {point} = require('@turf/turf')
const {slugify} = require('@etalab/adresses-util')
const {getCenterFromPoints, derivePositionProps} = require('../../util/geo.cjs')
const {getCodeDepartement, getPLMCodeCommune, getNomCommune, getDepartement, getRegion, getCommune, getCommunes} = require('../../util/cog.cjs')
const geo = require('../../../geo.json')

const buildContext = memoize(codeDepartement => {
  const departement = getDepartement(codeDepartement)
  const region = departement.region ? getRegion(departement.region) : departement
  return uniq([codeDepartement, departement.nom, region.nom]).join(', ')
})

function buildImportance(populationCommune = 0, nombreNumerosVoie = 0) {
  const importance = (Math.log(1 + (populationCommune / 3)) + Math.log(1 + nombreNumerosVoie)) / 20
  return Number.parseFloat(importance.toFixed(5))
}

function getCenterProps(commune, numeros) {
  if (numeros.length > 0) {
    const centroid = getCenterFromPoints(numeros.map(n => n.position))
    return derivePositionProps(centroid)
  }

  if (geo[commune.code]) {
    return derivePositionProps(point(geo[commune.code].center).geometry)
  }

  throw new Error(`Impossible de créer la position de la commune ${commune.code}`)
}

function buildMunicipality(commune, numeros = []) {
  const {x, y, lon, lat} = getCenterProps(commune, numeros)
  const districtIdBan = numeros?.[0]?.banIdDistrict || null

  return {
    id: commune.code,
    banId: districtIdBan,
    type: 'municipality',
    name: commune.nom,
    postcode: commune.codesPostaux,
    citycode: commune.code,
    x,
    y,
    lon,
    lat,
    population: commune.population,
    city: commune.nom,
    context: buildContext(getCodeDepartement(commune.code)),
    importance: buildImportance(commune.population)
  }
}

function buildStreet(voie, forceAddOldCity = false) {
  const commune = getCommune(voie.codeCommune, true)
  const housenumbers = fromPairs(voie.numeros.map(numero => [
    [numero.numero || '0', numero.suffixe].filter(Boolean).join(''),
    {
      id: numero.cleInterop,
      banId: numero.banId || null,
      x: numero.x,
      y: numero.y,
      lon: numero.lon,
      lat: numero.lat
    }
  ]))

  return {
    ...computeCommonVoieProps(voie, forceAddOldCity),

    type: 'street',
    importance: buildImportance(commune.population, voie.numeros.length),
    housenumbers
  }
}

function computeCommonVoieProps(voie, forceAddOldCity = false) {
  const commune = getCommune(voie.codeCommune, true)
  const codeCommuneArrondissement = getPLMCodeCommune(commune.code)

  return {
    id: voie.idVoie,
    banId: voie.banId || null,
    name: forceAddOldCity && voie.nomAncienneCommune ? `${voie.nomVoie} (${voie.nomAncienneCommune})` : voie.nomVoie,
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
    context: buildContext(getCodeDepartement(commune.code))
  }
}

function buildLocality(lieuDit) {
  const commune = getCommune(lieuDit.codeCommune, true)

  return {
    type: 'locality',
    importance: buildImportance(commune.population, 1),

    ...computeCommonVoieProps(lieuDit, true)
  }
}

function waitForDrain(stream) {
  if (stream.writableLength > stream.writableHighWaterMark) {
    return new Promise(resolve => {
      stream.once('drain', resolve)
    })
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
    async writeAdresses({voies, numeros}) {
      if (voies.length === 0) {
        return
      }

      const {codeCommune} = voies[0]
      const commune = getCommune(codeCommune, true)

      voies.filter(a => a.type === 'lieu-dit' && a.lon && a.lat).forEach(lieuDit => {
        adressesStream.write(buildLocality(lieuDit))
      })

      const numerosGeolocalises = groupBy(numeros.filter(n => n.lon && n.lat), 'idVoie')

      const voiesAvecNumeros = voies
        .filter(v => v.lon && v.lat && v.idVoie in numerosGeolocalises && v.type === 'voie')
        .map(v => ({...v, numeros: numerosGeolocalises[v.idVoie]}))

      if (voiesAvecNumeros.length > 0) {
        adressesStream.write(buildMunicipality(
          commune,
          chain(voiesAvecNumeros).map('numeros').flatten().filter(n => n.position).value()
        ))
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
      getCommunes(true)
        .filter(c => c.departement === departement && !communesWithAdresses.includes(c.code))
        .forEach(commune => {
          try {
            const municipality = buildMunicipality(commune)
            adressesStream.write(municipality)
          } catch {}
        })

      adressesStream.end()
      await finished(adressesFile)
    }
  }
}

module.exports = {createWriter}
