import {Op} from 'sequelize'
import {CommonToponym} from '../../util/sequelize.js'

export const getCommonToponym = commonToponymID => CommonToponym.findByPk(commonToponymID, {raw: true})

export const getCommonToponyms = commonToponymIDs => CommonToponym.findAll({where: {id: commonToponymIDs}, raw: true})

export const getAllCommonToponymIDsWithHashFromDistrict = async districtID => {
  const commonToponyms = await CommonToponym.findAll(
    {where: {districtID}, attributes: ['id', 'meta', 'isActive'], raw: true}
  )
  return commonToponyms.map(commonToponym => ({id: commonToponym.id, hash: commonToponym.meta?.idfix?.hash, isActive: commonToponym.isActive}))
}

export const getAllCommonToponymIDsOutsideDistrict = async (commonToponymIDs, districtID) => {
  const commonToponyms = await CommonToponym.findAll(
    {where: {id: commonToponymIDs, districtID: {[Op.ne]: districtID}}, attributes: ['id'], raw: true}
  )
  return commonToponyms.map(commonToponym => commonToponym.id)
}

export const setCommonToponyms = commonToponyms => CommonToponym.bulkCreate(commonToponyms)

export const updateCommonToponyms = commonToponyms => {
  const bulkOperations = commonToponyms.map(commonToponym =>
    CommonToponym.update({...commonToponym, isActive: true}, {where: {id: commonToponym.id}})
  )
  return Promise.all(bulkOperations)
}

export const patchCommonToponyms = async commonToponyms => {
  const bulkOperations = commonToponyms.map(async commonToponym => {
    // Separate meta from the rest of the object to process the update separately
    const {meta, ...commonToponymRest} = commonToponym
    const commonToponymID = commonToponym.id
    const commonToponymDB = await CommonToponym.findByPk(commonToponymID)
    commonToponymDB.set({...commonToponymRest, isActive: true})
    commonToponymDB.meta = {...commonToponymDB.meta, ...meta}
    return commonToponymDB.save()
  })

  return Promise.all(bulkOperations)
}

export const deleteCommonToponym = commonToponymID => CommonToponym.update({isActive: false}, {where: {id: commonToponymID}})

export const deleteCommonToponyms = commonToponymIDs => CommonToponym.update({isActive: false}, {where: {id: commonToponymIDs}})

export const getAllDistrictIDsFromCommonToponyms = async commonToponymIDs => {
  const commonToponyms = await CommonToponym.findAll({where: {id: commonToponymIDs}, attributes: ['districtID'], raw: true})
  return commonToponyms.map(commonToponym => commonToponym.districtID)
}
