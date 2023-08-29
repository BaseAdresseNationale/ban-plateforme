import {Op} from 'sequelize'
import {CommonToponym} from '../../util/sequelize.js'

export async function getCommonToponym(commonToponymID) {
  return CommonToponym.findByPk(commonToponymID, {raw: true})
}

export async function getCommonToponyms(commonToponymIDs) {
  return CommonToponym.findAll({where: {id: commonToponymIDs}, raw: true})
}

export async function getAllCommonToponymIDsFromDistrict(districtID) {
  const commonToponyms = await CommonToponym.findAll({where: {districtID}, raw: true})
  return commonToponyms.map(commonToponym => commonToponym.id)
}

export async function getAllCommonToponymIDsOutsideDistrict(commonToponymIDs, districtID) {
  const commonToponyms = await CommonToponym.findAll({where: {id: commonToponymIDs, districtID: {[Op.ne]: districtID}}, raw: true})
  return commonToponyms.map(commonToponym => commonToponym.id)
}

export async function setCommonToponyms(commonToponyms) {
  return CommonToponym.bulkCreate(commonToponyms)
}

export async function updateCommonToponyms(commonToponyms) {
  const bulkOperations = commonToponyms.map(commonToponym => CommonToponym.update(commonToponym, {where: {id: commonToponym.id}}))
  return Promise.all(bulkOperations)
}

export async function deleteCommonToponym(commonToponymID) {
  return CommonToponym.destroy({where: {id: commonToponymID}})
}

export async function deleteCommonToponyms(commonToponymIDs) {
  return CommonToponym.destroy({where: {id: commonToponymIDs}})
}
