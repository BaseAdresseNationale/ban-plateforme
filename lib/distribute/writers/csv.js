/* eslint camelcase: off */
const {promisify} = require('util')
const {join} = require('path')
const {createWriteStream} = require('fs')
const {createGzip} = require('zlib')
const finished = promisify(require('stream').finished)
const {keyBy} = require('lodash')
const {ensureDir} = require('fs-extra')
const csvWriter = require('csv-write-stream')
const normalize = require('@etalab/normadresse')
const {beautify} = require('@etalab/adresses-util')
const pumpify = require('pumpify')

function getIdFantoirField(codeCommune, idVoie) {
  if (idVoie.length === 10) {
    const [codeCommuneVoie, codeVoie] = idVoie.toUpperCase().split('_')
    return `${codeCommuneVoie}_${codeVoie}`
  }
}

const SOURCES_MAPPING = {
  bal: 'commune',
  'ign-api-gestion-municipal_administration': 'commune',
  'ign-api-gestion-laposte': 'laposte',
  'ign-api-gestion-sdis': 'sdis',
  'ign-api-gestion-ign': 'inconnue',
  cadastre: 'cadastre',
  ftth: 'arcep',
  'insee-ril': 'insee'
}

function getSource(rawSource) {
  if (rawSource in SOURCES_MAPPING) {
    return SOURCES_MAPPING[rawSource]
  }
}

function adresseToRow(a) {
  return {
    id: a.cleInterop,
    id_fantoir: getIdFantoirField(a.codeCommune, a.idVoie) || '',
    numero: a.numero,
    rep: a.suffixe || '',
    nom_voie: beautify(a.nomVoie),
    code_postal: a.codePostal || '',
    code_insee: a.codeCommune,
    nom_commune: a.nomCommune,
    code_insee_ancienne_commune: a.codeAncienneCommune || '',
    nom_ancienne_commune: a.nomAncienneCommune || '',

    x: a.x || '',
    y: a.y || '',
    lon: a.lon || '',
    lat: a.lat || '',

    alias: '',
    nom_ld: '',
    libelle_acheminement: a.libelleAcheminement || '',
    nom_afnor: normalize(a.nomVoie),

    source_position: getSource(a.sourcePosition) || '',
    source_nom_voie: getSource(a.sourceNomVoie) || ''
  }
}

function lieuDitToRow(a) {
  return {
    id: a.idVoie,
    nom_lieu_dit: beautify(a.nomVoie),
    code_postal: a.codePostal || '',
    code_insee: a.codeCommune,
    nom_commune: a.nomCommune,
    code_insee_ancienne_commune: a.codeAncienneCommune || '',
    nom_ancienne_commune: a.nomAncienneCommune || '',

    x: a.x || '',
    y: a.y || '',
    lon: a.lon || '',
    lat: a.lat || '',

    source_position: a.source,
    source_nom_voie: a.source
  }
}

function createCsvWriteStream(file) {
  return pumpify.obj(
    csvWriter({separator: ';'}),
    createGzip(),
    file
  )
}

function waitForDrain(stream) {
  if (stream.writableLength > stream.writableHighWaterMark) {
    return new Promise(resolve => stream.once('drain', resolve))
  }
}

async function createWriter(outputPath, departement) {
  await ensureDir(outputPath)

  const adressesFile = createWriteStream(join(outputPath, `adresses-${departement}.csv.gz`))
  const lieuxDitsFile = createWriteStream(join(outputPath, `lieux-dits-${departement}-beta.csv.gz`))

  const adressesStream = createCsvWriteStream(adressesFile)
  const lieuxDitsStream = createCsvWriteStream(lieuxDitsFile)

  return {
    async writeAdresses({voies, numeros}) {
      const voiesIndex = keyBy(voies, 'idVoie')

      voies.filter(v => v.type === 'lieu-dit').forEach(voie => {
        lieuxDitsStream.write(lieuDitToRow(voie))
      })

      numeros.forEach(numero => {
        const voie = voiesIndex[numero.idVoie]

        if (!voie) {
          throw new Error(`Voie ${numero.idVoie} introuvable`)
        }

        if (numero.position && numero.lon && numero.lat) {
          adressesStream.write(adresseToRow({...voie, ...numero}))
        }
      })

      await Promise.all([
        waitForDrain(adressesStream),
        waitForDrain(lieuxDitsStream)
      ])
    },

    async finish() {
      adressesStream.end()
      lieuxDitsStream.end()

      await Promise.all([
        finished(adressesFile),
        finished(lieuxDitsFile)
      ])
    }
  }
}

module.exports = {createWriter}
