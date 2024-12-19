import {readFileSync} from 'node:fs'
import {createHmac} from 'node:crypto'
import {convertToLegacyPositionType} from '../helper.js'
import {getCommune as getDistrictFromAdminDivision, getRegion, getDepartement as getDepartment} from '../../util/cog.cjs'

const districtsGeographicOutlineJsonURL = new URL('../../../geo.json', import.meta.url)
const districtsGeographicOutline = JSON.parse(readFileSync(districtsGeographicOutlineJsonURL))

const districtsAddressesExtraDataJsonURL = new URL(`../../../${process.env.COMMUNES_LOCAUX_ADRESSES_DATA_PATH}`, import.meta.url)
const districtsAddressesExtraData = JSON.parse(readFileSync(districtsAddressesExtraDataJsonURL))
const districtsAddressesExtraDataIndex = districtsAddressesExtraData.reduce((acc, commune) => {
  acc[commune.codeCommune] = commune
  return acc
}, {})

export const formatDistrictDataForLegacy = async (district, {totalCommonToponymRecords, totalSpecifCommonToponymRecords, totalAddressRecords, totalAddressCertifiedRecords}) => {
  const {id, meta, labels, config} = district
  const {insee: {cog}} = meta

  // District data from administrative division
  const districtFromAdminDivision = getDistrictFromAdminDivision(cog)
  const {population, codesPostaux: postalCodes, type} = districtFromAdminDivision
  const department = getDepartment(districtFromAdminDivision.departement)
  const region = getRegion(districtFromAdminDivision.region)

  // Labels
  const defaultLabel = getDefaultLabel(labels)
  const legacyLabelValue = defaultLabel?.value

  // Geographic data
  const districtGeoData = districtsGeographicOutline[cog]
  const districtBbox = districtGeoData?.bbox

  let addressAnalysis
  // Address analysis
  if (districtsAddressesExtraDataIndex[cog]) {
    const totalAddressesFromDistrict = districtsAddressesExtraDataIndex[cog].nbAdressesLocaux
    const ratio = totalAddressesFromDistrict && totalAddressRecords
      ? Math.round((totalAddressRecords / totalAddressesFromDistrict) * 100)
      : undefined
    const addressesDeficit = (population < 2000 && population > 0) ? ratio < 50 : undefined
    addressAnalysis = {
      nbAdressesAttendues: totalAddressesFromDistrict,
      ratio,
      deficitAdresses: addressesDeficit
    }
  }

  return {
    banId: id,
    codeCommune: cog,
    nomCommune: legacyLabelValue,
    population,
    departement: {nom: department?.nom, code: department?.code},
    region: {nom: region?.nom, code: region?.code},
    codesPostaux: postalCodes || [],
    displayBBox: districtBbox,
    typeCommune: type,
    typeComposition: 'bal',
    nbVoies: totalCommonToponymRecords - totalSpecifCommonToponymRecords,
    nbLieuxDits: totalSpecifCommonToponymRecords,
    nbNumeros: totalAddressRecords,
    nbNumerosCertifies: totalAddressCertifiedRecords,
    ...(addressAnalysis ? {analyseAdressage: addressAnalysis} : {}),
    idRevision: meta?.bal?.idRevision,
    dateRevision: meta?.bal?.dateRevision,
    composedAt: new Date(),
    withBanId: true,
    config
  }
}

export const formatCommonToponymDataForLegacy = async (commonToponym, {district, pseudoCodeVoieGenerator, commonToponymLegacyIDCommonToponymIDMap, commonToponymLegacyIDSet, gazetteerFinder}) => {
  const {labels: districtLabels, meta: {insee: {cog}}, config} = district
  const {id, districtID, geometry, labels, meta, updateDate, addressCount, certifiedAddressCount, bbox} = commonToponym

  // Labels
  // District
  const {value: districtLegacyLabelValue} = getDefaultLabel(districtLabels)

  // Common toponym
  const defaultLabel = getDefaultLabel(labels)
  const defaultLabelIsoCode = defaultLabel?.isoCode
  const legacyLabelValue = defaultLabel?.value
  const legacyComplementaryLabels = formatLegacyComplementatyLabels(labels, defaultLabelIsoCode)

  // Geographic data
  const legacyPosition = {
    ...geometry,
    coordinates: [round(geometry?.coordinates?.[0]), round(geometry?.coordinates?.[1])]
  }
  const lon = legacyPosition?.coordinates?.[0]
  const lat = legacyPosition?.coordinates?.[1]
  const commonToponymBbox = formatBboxForLegacy(bbox)

  // Old district
  const {codeAncienneCommune, nomAncienneCommune} = await calculateLegacyCommuneAncienne(cog, meta, lon, lat, gazetteerFinder)

  // Ids
  const legacyCommonToponymFantoirId = meta?.dgfip?.fantoir ? `${cog}_${meta?.dgfip?.fantoir}` : null

  let legacyCommonToponymId = legacyCommonToponymFantoirId
  // If the legacy common toponym id is already used or not defined, we calculate a pseudo code
  if (!legacyCommonToponymId || commonToponymLegacyIDSet.has(legacyCommonToponymId)) {
    legacyCommonToponymId = `${cog}_${pseudoCodeVoieGenerator.getCode(legacyLabelValue, codeAncienneCommune)}`.toLowerCase()
    // If the pseudo code is already used, we generate a new one with a hash from the common toponym id
    if (commonToponymLegacyIDSet.has(legacyCommonToponymId)) {
      legacyCommonToponymId = `${cog}_${createHmac('sha256', 'ban').update(id).digest('hex').slice(0, 6)}`
    }
  }

  // Store the legacy common toponym id for each common toponym to then be able to set it on legacy addresses
  commonToponymLegacyIDCommonToponymIDMap.set(id, legacyCommonToponymId)

  // Store all the legacy common toponym id
  commonToponymLegacyIDSet.add(legacyCommonToponymId)

  // Check if the common toponym is a lieu-dit
  const isLieuDit = meta?.bal?.isLieuDit

  if (isLieuDit) {
    // Update Date
    const legacyUpdateDate = formatLegacyUpdateDate(updateDate)
    return {
      banId: id,
      banIdDistrict: districtID,
      type: 'lieu-dit',
      source: 'bal',
      idVoie: legacyCommonToponymId,
      nomVoie: legacyLabelValue,
      nomVoieAlt: legacyComplementaryLabels,
      codeCommune: cog,
      nomCommune: districtLegacyLabelValue,
      codeAncienneCommune,
      nomAncienneCommune,
      codePostal: meta?.laposte?.codePostal,
      parcelles: meta?.cadastre?.ids || [],
      lon,
      lat,
      x: meta?.geography?.x,
      y: meta?.geography?.y,
      tiles: meta?.geography?.tiles,
      position: legacyPosition,
      displayBBox: commonToponymBbox,
      dateMAJ: legacyUpdateDate,
      withBanId: true,
      config
    }
  }

  return {
    banId: id,
    banIdDistrict: districtID,
    type: 'voie',
    idVoie: legacyCommonToponymId,
    idVoieFantoir: legacyCommonToponymFantoirId,
    codeCommune: cog,
    nomCommune: districtLegacyLabelValue,
    codeAncienneCommune,
    nomAncienneCommune,
    nomVoie: legacyLabelValue,
    nomVoieAlt: legacyComplementaryLabels,
    sourceNomVoie: 'bal',
    position: legacyPosition,
    codePostal: meta?.laposte?.codePostal,
    displayBBox: commonToponymBbox,
    lon,
    lat,
    x: meta?.geography?.x,
    y: meta?.geography?.y,
    tiles: meta?.geography?.tiles,
    sources: ['bal'],
    nbNumeros: Number.parseInt(addressCount, 10),
    nbNumerosCertifies: Number.parseInt(certifiedAddressCount, 10),
    withBanId: true,
    config
  }
}

export const formatAddressDataForLegacy = async (address, {district, commonToponymLegacyIDCommonToponymIDMap, addressLegacyIDSet, gazetteerFinder}) => {
  const {meta: {insee: {cog}}, config} = district
  const {id, mainCommonToponymID, secondaryCommonToponymIDs, districtID, number, suffix, positions, labels, meta, updateDate, certified, bbox} = address

  // Labels
  const defaultLabel = getDefaultLabel(labels)
  const defaultLabelIsoCode = defaultLabel?.isoCode
  const legacyLabelValue = defaultLabel?.value
  const legacyComplementaryLabels = formatLegacyComplementatyLabels(labels, defaultLabelIsoCode)

  // Update Date
  const legacyUpdateDate = formatLegacyUpdateDate(updateDate)

  // Geographic data
  const legacyPositions = positions.map(position => ({position: position.geometry, positionType: convertToLegacyPositionType(position.type)}))
  const legacyPosition = legacyPositions?.[0]?.position
  const legacyPositionType = legacyPositions?.[0]?.positionType
  const [lon, lat] = formatLegacyLonLat(legacyPosition)
  const addressBbox = formatBboxForLegacy(bbox)

  // Ids
  const legacyCommonToponymId = commonToponymLegacyIDCommonToponymIDMap.get(mainCommonToponymID)
  // Temporary check : if the legacy common toponym id is not found, we don't create the address
  if (!legacyCommonToponymId) {
    console.log(`Address ${id} not created because its common toponym (id : ${mainCommonToponymID}) does not exist on this district (id : ${districtID} - cog: ${cog})`)
    return
  }

  const legacyInteropKey = `${legacyCommonToponymId}_${String(number).padStart(5, '0')}${suffix ? `_${suffix}` : ''}`.toLowerCase()
  const legacyID = getAddressLegacyId(addressLegacyIDSet, legacyInteropKey)
  addressLegacyIDSet.add(legacyID)
  const banIdSecondaryCommonToponyms = secondaryCommonToponymIDs && secondaryCommonToponymIDs.length > 0 ? secondaryCommonToponymIDs : null
  const legacySuffix = suffix ? suffix : null

  // Old district
  const {codeAncienneCommune, nomAncienneCommune} = await calculateLegacyCommuneAncienne(cog, meta, lon, lat, gazetteerFinder)

  return {
    id: legacyID,
    cleInterop: legacyInteropKey,
    banId: id,
    banIdDistrict: districtID,
    banIdMainCommonToponym: mainCommonToponymID,
    banIdSecondaryCommonToponyms,
    idVoie: legacyCommonToponymId,
    codeCommune: cog,
    codeAncienneCommune,
    nomAncienneCommune,
    numero: number,
    suffixe: legacySuffix,
    lieuDitComplementNom: legacyLabelValue,
    lieuDitComplementNomAlt: legacyComplementaryLabels || {},
    parcelles: meta?.cadastre?.ids || [],
    positions: legacyPositions,
    position: legacyPosition,
    positionType: legacyPositionType,
    displayBBox: addressBbox,
    lon,
    lat,
    x: meta?.geography?.x,
    y: meta?.geography?.y,
    tiles: meta?.geography?.tiles,
    sources: ['bal'],
    sourcePosition: 'bal',
    dateMAJ: legacyUpdateDate,
    certifie: certified,
    codePostal: meta?.laposte?.codePostal,
    libelleAcheminement: meta?.laposte?.libelleAcheminement,
    adressesOriginales: [address],
    withBanId: true,
    config
  }
}

// Helper for formatting bbox to legacy bbox format
const formatBboxForLegacy = bbox => {
  if (!bbox) {
    return
  }

  const {coordinates} = bbox
  const allLon = []
  const allLat = []
  coordinates[0].forEach(([lon, lat]
  ) => {
    allLon.push(Number.parseFloat(lon))
    allLat.push(Number.parseFloat(lat))
  })
  const lonMin = round(Math.min(...allLon), 4)
  const latMin = round(Math.min(...allLat), 4)
  const lonMax = round(Math.max(...allLon), 4)
  const latMax = round(Math.max(...allLat), 4)
  return [lonMin, latMin, lonMax, latMax]
}

const round = (value, precision = 6) => {
  if (!value) {
    return
  }

  return Number.parseFloat(Number.parseFloat(value).toFixed(precision))
}

const getDefaultLabel = (labels, icoCode = 'fr') => {
  if (!labels || labels.length === 0) {
    return
  }

  const label = labels.find(({isoCode}) => isoCode === icoCode)
  return label || labels[0]
}

const formatLegacyComplementatyLabels = (labels, defaultLabelIsoCode) => {
  if (!labels || labels.length === 0) {
    return
  }

  const complementaryLabels = labels?.filter(({isoCode}) => isoCode !== defaultLabelIsoCode)
  return complementaryLabels.reduce((acc, {isoCode, value}) => {
    acc[isoCode] = value
    return acc
  }, {})
}

const formatLegacyUpdateDate = date => {
  if (!date) {
    return
  }

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0') // Adding 1 to month because it's 0-based
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const formatLegacyLonLat = position => {
  if (!position) {
    return
  }

  const {coordinates} = position
  const lon = round(coordinates?.[0])
  const lat = round(coordinates?.[1])
  return [lon, lat]
}

const getAddressLegacyId = (addressLegacyIDSet, legacyInteropKey, suffix = 0) => {
  if (addressLegacyIDSet.has(legacyInteropKey)) {
    return getAddressLegacyId(addressLegacyIDSet, `${legacyInteropKey}__${suffix}`, suffix++)
  }

  return `${legacyInteropKey}`
}

const calculateLegacyCommuneAncienne = async (cog, meta, lon, lat, gazetteerFinder) => {
  const codeAncienneCommuneFromBal = meta?.bal?.codeAncienneCommune
  const nomAncienneCommuneFromBal = meta?.bal?.nomAncienneCommune
  if (codeAncienneCommuneFromBal && nomAncienneCommuneFromBal) {
    return {codeAncienneCommune: codeAncienneCommuneFromBal, nomAncienneCommune: nomAncienneCommuneFromBal}
  }

  if (!lon || !lat) {
    return {}
  }

  const gazetteerResult = await gazetteerFinder.find({lon, lat})

  if (!gazetteerResult) {
    return {}
  }

  const {communeAncienne, commune} = gazetteerResult
  if (!communeAncienne || commune?.code !== cog) {
    return {}
  }

  return {codeAncienneCommune: communeAncienne.code, nomAncienneCommune: communeAncienne.nom}
}
