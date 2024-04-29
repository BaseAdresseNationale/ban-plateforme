import {Address} from '../../util/sequelize.js'

export const getAddress = addressID => Address.findByPk(addressID, {raw: true})

export const getAddresses = addressIDs => Address.findAll({where: {id: addressIDs}, raw: true})

export const getAddressesByFilters = (filters, attributes) => Address.findAll({where: filters, attributes, raw: true})

export const setAddresses = addresses => Address.bulkCreate(addresses)

export const updateAddresses = async addresses => {
  const bulkOperations = addresses.map(address => Address.update({...address, isActive: true}, {where: {id: address.id}}))
  return Promise.all(bulkOperations)
}

export const patchAddresses = async addresses => {
  const bulkOperations = addresses.map(async address => {
    // Separate meta from the rest of the object to process the update separately
    const {meta, ...addressRest} = address
    const addressID = address.id
    const addressDB = await Address.findByPk(addressID)
    addressDB.set({...addressRest, isActive: true})
    addressDB.meta = {...addressDB.meta, ...meta}
    return addressDB.save()
  })

  return Promise.all(bulkOperations)
}

export const deleteAddress = addressID => Address.update({isActive: false}, {where: {id: addressID}})

export const deleteAddresses = addressIDs => Address.update({isActive: false}, {where: {id: addressIDs}})

export const getAllDistrictIDsFromAddresses = async addressIDs => {
  const addresses = await Address.findAll({where: {id: addressIDs}, attributes: ['districtID'], raw: true})
  return addresses.map(address => address.districtID)
}
