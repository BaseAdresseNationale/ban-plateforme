import {District} from '../../util/sequelize.js'

export async function getDistrict(districtID) {
  return District.findByPk(districtID, {raw: true})
}

export async function getDistricts(districtIDs) {
  return District.findAll({where: {id: districtIDs}, raw: true})
}

export async function getDistrictsFromCog(cog) {
  return District.findAll({where: {meta: {insee: {cog}}}, raw: true})
}

export async function setDistricts(districts) {
  return District.bulkCreate(districts)
}

export async function updateDistricts(districts) {
  const promises = districts.map(district => District.update(district, {where: {id: district.id}}))
  return Promise.all(promises)
}

export async function deleteDistrict(districtID) {
  return District.destroy({where: {id: districtID}})
}

export async function deleteDistricts(districtIDs) {
  return District.destroy({where: {id: districtIDs}})
}
