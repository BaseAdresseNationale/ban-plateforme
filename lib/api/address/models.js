import {Op} from 'sequelize'
import {Address} from '../../util/sequelize.js'

export async function getAddress(addressID) {
  return Address.findByPk(addressID, {raw: true})
}

export async function getAddresses(addressIDs) {
  return Address.findAll({where: {id: addressIDs}, raw: true})
}

export async function getAllAddressIDsFromDistrict(districtID) {
  const addresses = await Address.findAll({where: {districtID}, attributes: ['id'], raw: true})
  return addresses.map(address => address.id)
}

export async function getAllAddressIDsOutsideDistrict(addressIDs, districtID) {
  const addresses = await Address.findAll({where: {id: addressIDs, districtID: {[Op.ne]: districtID}}, attributes: ['id'], raw: true})
  return addresses.map(address => address.id)
}

export async function setAddresses(addresses) {
  return Address.bulkCreate(addresses)
}

export async function updateAddresses(addresses) {
  const bulkOperations = addresses.map(address => Address.update(address, {where: {id: address.id}}))
  return Promise.all(bulkOperations)
}

export async function deleteAddress(addressID) {
  return Address.destroy({where: {id: addressID}})
}

export async function deleteAddresses(addressIDs) {
  return Address.destroy({where: {id: addressIDs}})
}
