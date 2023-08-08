import {Address, CommonToponym, District} from '../../util/sequelize.js'

export async function idsInDataBase(ids) {
  return (
    await Promise.all([
      Address.findAll({where: {id: ids}, raw: true}),
      CommonToponym.findAll({where: {id: ids}, raw: true}),
      District.findAll({where: {id: ids}, raw: true}),
    ])
  ).flat()
}
