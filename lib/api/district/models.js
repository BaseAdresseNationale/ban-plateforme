import {Op} from 'sequelize'
import {District} from '../../util/sequelize.js'

export const getDistrict = districtID => District.findByPk(districtID, {raw: true})

export const getDistricts = districtIDs => District.findAll({where: {id: districtIDs}, raw: true})

export const getDistrictFromCog = cog => District.findAll({where: {meta: {insee: {cog}}}, raw: true})

export const getDistrictsFromCog = async cog => {
  const districts = await District.findAll({where: {meta: {insee: {cog: {[Op.or]: cog}}}}, raw: true})
  const districtsByInseeCode = districts.reduce(
    (acc, district) => {
      if (!acc[district.meta?.insee?.cog]) {
        acc[district.meta.insee.cog] = district
      }

      return acc
    }, {})
  return cog.map(codeInsee => districtsByInseeCode[codeInsee] || {})
}

export const setDistricts = districts => District.bulkCreate(districts)

export const updateDistricts = districts => {
  const promises = districts.map(district => District.update({...district, isActive: true}, {where: {id: district.id}}))
  return Promise.all(promises)
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
