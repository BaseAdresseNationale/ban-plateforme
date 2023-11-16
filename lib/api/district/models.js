import {District} from '../../util/sequelize.js'

export const getDistrict = districtID => District.findByPk(districtID, {raw: true})

export const getDistricts = districtIDs => District.findAll({where: {id: districtIDs}, raw: true})

export const getDistrictsFromCog = cog => District.findAll({where: {meta: {insee: {cog}}}, raw: true})

export const setDistricts = districts => District.bulkCreate(districts)

export const updateDistricts = districts => {
  const promises = districts.map(district => District.update(district, {where: {id: district.id}}))
  return Promise.all(promises)
}

export const patchDistricts = async districts => {
  const bulkOperations = districts.map(async district => {
    // Separate meta from the rest of the object to process the update separately
    const {meta, ...districtRest} = district
    const districtID = district.id
    const districtDB = await District.findByPk(districtID)
    districtDB.set(districtRest)
    districtDB.meta = {...districtDB.meta, ...meta}
    return districtDB.save()
  })

  return Promise.all(bulkOperations)
}

export const deleteDistrict = districtID => District.destroy({where: {id: districtID}})

export const deleteDistricts = districtIDs => District.destroy({where: {id: districtIDs}})
