import {Sequelize, Op} from 'sequelize'
import {District} from '../../util/sequelize.js'
import mongo from '../../util/mongo.cjs'

export const getDistrict = districtID => District.findByPk(districtID, {raw: true})

export const getDistricts = districtIDs => District.findAll({where: {id: districtIDs}, raw: true})

export const getDistrictsFromCog = cog => District.findAll({where: {
  [Op.or]: [
    {meta: {insee: {cog}}},
    {meta: {insee: {mainCog: cog}}},
  ]
}, order: [
  ['isActive', 'DESC'],
  [Sequelize.literal('(meta#>>\'{insee, isMain}\')::BOOLEAN'), 'DESC'],
  [Sequelize.literal('labels[1]#>>\'{value}\''), 'ASC']
], raw: true})

export const setDistricts = districts => District.bulkCreate(districts)

export const getCogFromDistrictID = async districtID => {
  const district = await District.findByPk(districtID, {raw: true})
  return district ? district.meta?.insee?.cog : null
}

export const updateDistricts = districts => {
  const promises = districts.map(district => District.update({...district, isActive: true}, {where: {id: district.id}}))
  return Promise.all(promises)
}

export const disableDistrictAddressingCertification = async districtID => {
  if (!districtID) {
    throw new Error('District ID is required to disable addressing certification')
  }

  const district = await District.findByPk(districtID)
  if (!district) {
    throw new Error('District not found')
  }

  if (district.config && Object.prototype.hasOwnProperty.call(district.config, 'certificate')) {
    const {certificate, ...restConfig} = district.config
    district.config = restConfig
    const result = await district.save()
    return result
  }

  return district
}

export const enableDistrictAddressingCertification = async (districtID, certificateType) => {
  if (!districtID) {
    throw new Error('District ID is required to enable addressing certification')
  }

  const district = await District.findByPk(districtID)
  if (!district) {
    throw new Error('District not found')
  }

  const update = district.config === null ? {config: {certificate: certificateType}} : {'config.certificate': certificateType}
  const result = await district.update(update)
  return result
}

export const patchDistricts = async districts => {
  const bulkOperations = districts.map(async district => {
    const {meta, ...districtRest} = district
    const districtID = district.id
    const districtDB = await District.findByPk(districtID)
    if (districtRest.config) {
      const currentConfig = districtDB.config || {}
      const newConfig = {...currentConfig}

      for (const [key, value] of Object.entries(districtRest.config)) {
        if (value === null) {
          delete newConfig[key]
        } else {
          newConfig[key] = value
        }
      }
      
      districtRest.config = newConfig
    }

    districtDB.set({...districtRest, isActive: true})
    districtDB.meta = {...districtDB.meta, ...meta}
    return districtDB.save()
  })

  return Promise.all(bulkOperations)
}

export const deleteDistrict = districtID => District.update({isActive: false}, {where: {id: districtID}})

export const deleteDistricts = districtIDs => District.update({isActive: false}, {where: {id: districtIDs}})

const COLLECTION_NAME = 'communes_autorisees'

// Vérifie si un COG est autorisé
export async function isAuthorizedCog(cog) {
  await mongo.connect()
  const result = await mongo.db.collection(COLLECTION_NAME).findOne({cog})
  return Boolean(result)
}

// Ajoute une liste de COGs (avec gestion des doublons)
export async function addAuthorizedCogs(cogs) {
  await mongo.connect()

  // Supprimer les doublons dans la liste d'entrée
  const uniqueCogs = [...new Set(cogs)]

  // Récupérer les COGs déjà existants
  const existingCogs = await mongo.db.collection(COLLECTION_NAME)
    .find({cog: {$in: uniqueCogs}})
    .toArray()
  const existingCogsSet = new Set(existingCogs.map(doc => doc.cog))

  // Filtrer pour ne garder que les nouveaux COGs
  const newCogs = uniqueCogs.filter(cog => !existingCogsSet.has(cog))

  if (newCogs.length === 0) {
    return {
      insertedCount: 0,
      alreadyExist: uniqueCogs.length,
      duplicatesInRequest: cogs.length - uniqueCogs.length
    }
  }

  // Préparer les documents
  const docs = newCogs.map(cog => ({cog}))

  // Insertion
  const result = await mongo.db.collection(COLLECTION_NAME).insertMany(docs)

  return {
    insertedCount: result.insertedCount,
    alreadyExist: existingCogsSet.size,
    duplicatesInRequest: cogs.length - uniqueCogs.length
  }
}

// Supprime une liste de COGs (seulement ceux qui existent)
export async function removeAuthorizedCogs(cogs) {
  await mongo.connect()

  // Supprimer les doublons dans la liste d'entrée
  const uniqueCogs = [...new Set(cogs)]

  // Récupérer les COGs qui existent vraiment
  const existingCogs = await mongo.db.collection(COLLECTION_NAME)
    .find({cog: {$in: uniqueCogs}})
    .toArray()
  const existingCogsSet = new Set(existingCogs.map(doc => doc.cog))

  // Supprimer seulement ceux qui existent
  const result = await mongo.db.collection(COLLECTION_NAME).deleteMany({cog: {$in: uniqueCogs}})

  return {
    deletedCount: result.deletedCount,
    notFound: uniqueCogs.length - existingCogsSet.size,
    duplicatesInRequest: cogs.length - uniqueCogs.length
  }
}

// Récupère tous les COGs (juste la liste des strings)
export async function getAllAuthorizedCogs() {
  await mongo.connect()
  const results = await mongo.db.collection(COLLECTION_NAME).find({}).sort({cog: 1}).toArray()
  return results.map(doc => doc.cog)
}
