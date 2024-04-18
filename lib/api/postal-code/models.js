import {PostalArea} from '../../util/sequelize.js'

export const getAllPostalAreas = () => PostalArea.findAll({attributes: ['postalCode']})

export const putPostalAreas = postalAreas => PostalArea.bulkCreate(postalAreas, {updateOnDuplicate: ['geometry'], subQuery: false})

export const deletePostalAreas = postalCodes => {
  postalCodes.map(postalCode => PostalArea.destroy({where: {postalCode}}))
}
