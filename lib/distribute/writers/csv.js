/* eslint camelcase: off */
const {promisify} = require('util')
const {join} = require('path')
const {createWriteStream} = require('fs')
const {createGzip} = require('zlib')
const pipeline = promisify(require('stream').pipeline)
const {ensureFile} = require('fs-extra')
const intoStream = require('into-stream')
const csvWriter = require('csv-write-stream')
const normalize = require('@etalab/normadresse')
const {beautify} = require('@etalab/adresses-util')

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
  'ban-v0': 'inconnue',
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

    source_position: 'cadastre',
    source_nom_voie: 'cadastre'
  }
}

async function writeAdresses(filePath, adresses) {
  await ensureFile(filePath)

  await pipeline(
    intoStream.object(adresses.filter(a => a.position && a.lon && a.lat).map(adresseToRow)),
    csvWriter({separator: ';'}),
    createGzip(),
    createWriteStream(filePath)
  )
}

async function writeLieuxDits(filePath, lieuxDits) {
  await ensureFile(filePath)

  await pipeline(
    intoStream.object(lieuxDits.map(lieuDitToRow)),
    csvWriter({separator: ';'}),
    createGzip(),
    createWriteStream(filePath)
  )
}

async function writeData({outputPath, departement, adresses, lieuxDits}) {
  await writeAdresses(join(outputPath, `adresses-${departement}.csv.gz`), adresses)
  await writeLieuxDits(join(outputPath, `lieux-dits-${departement}-beta.csv.gz`), lieuxDits)
}

module.exports = {writeData}
