import {Sequelize, Op} from 'sequelize'
import {District} from '../../util/sequelize.js'

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

  // Ensure config exists and remove only the 'certificate' property
  if (district.config && Object.prototype.hasOwnProperty.call(district.config, 'certificate')) {
    const {certificate, ...restConfig} = district.config
    district.config = restConfig
    const result = await district.save()
    return result
  }

  // Nothing to remove; return district as-is
  return district
}

export const enableDistrictAddressingCertification = async districtID => {
  if (!districtID) {
    throw new Error('District ID is required to enable addressing certification')
  }

  const district = await District.findByPk(districtID)
  if (!district) {
    throw new Error('District not found')
  }
  // Ensure the config object exists and add the certificate property only, there other properties to keep

  district.config = {...district.config, certificate: {}}
  const result = await district.save()
  return result
}

export const patchDistricts = async districts => {
  const bulkOperations = districts.map(async district => {
    // Separate meta from the rest of the object to process the update separately
    const {meta, ...districtRest} = district
    const districtID = district.id
    const districtDB = await District.findByPk(districtID)
    districtDB.set({...districtRest, isActive: true})
    districtDB.meta = {...districtDB.meta, ...meta}
    return districtDB.save()
  })

  return Promise.all(bulkOperations)
}

export const deleteDistrict = districtID => District.update({isActive: false}, {where: {id: districtID}})

export const deleteDistricts = districtIDs => District.update({isActive: false}, {where: {id: districtIDs}})