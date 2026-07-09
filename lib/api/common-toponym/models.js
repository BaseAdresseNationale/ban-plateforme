import {CommonToponym, sequelize} from '../../util/sequelize.js'

const idfixHashAttribute = [sequelize.literal('"meta"->\'idfix\'->>\'hash\''), 'hash']

export const getCommonToponym = commonToponymID => CommonToponym.findByPk(commonToponymID, {raw: true})

export const getCommonToponyms = commonToponymIDs => CommonToponym.findAll({where: {id: commonToponymIDs}, raw: true})

export const getCommonToponymsByFilters = (filters, attributes) => CommonToponym.findAll({where: filters, attributes, raw: true})

// Delta-report only: load the idfix hash without hydrating the whole meta JSONB.
export const getCommonToponymsForDeltaReport = (filters, extraAttributes = []) =>
  CommonToponym.findAll({
    where: filters,
    attributes: ['id', 'isActive', ...extraAttributes, idfixHashAttribute],
    raw: true,
  })

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

export const getCommonToponymsCountByDistrict = districtID =>
  CommonToponym.count({
    where: {
      districtID,
      isActive: true
    }
  })
