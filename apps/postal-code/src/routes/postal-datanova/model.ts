import { Datanova } from '../../util/sequelize.js'
import { logger } from '@ban/tools'

interface DatanovaUpdate {
  postalCodes: string[]
  libelleAcheminementWithPostalCodes: Record<string, string>
  inseeCom: string
  updatedBy?: string
}

export const updateDatanova = async ({postalCodes, libelleAcheminementWithPostalCodes, inseeCom, updatedBy}: DatanovaUpdate) => {
  try {
    const [updatedRowsCount] = await Datanova.update(
      {
        postalCodes,
        libelleAcheminementWithPostalCodes,
        updatedAt: new Date(),
        updatedBy,
      },
      {where: {inseeCom}}
    )
    return {inseeCom, updatedRowsCount}
  } catch (error) {
    return {inseeCom, error: (error as Error).message}
  }
}

export const updateMultipleDatanova = async (items: DatanovaUpdate[]) => {
  logger.log('Start postal-datanova updated')
  // eslint-disable-next-line unicorn/no-array-callback-reference
  const results = await Promise.all(items.map(updateDatanova))

  const totalUpdated = results.reduce((acc, {updatedRowsCount}) => acc + (updatedRowsCount || 0), 0)

  const errors = results.filter(({updatedRowsCount, error}) => updatedRowsCount === 0 || error)
  if (errors.length > 0) {
    logger.error('The following records were not updated:')
    errors.forEach(({inseeCom, error}) => {
      logger.error(`- inseeCom: ${inseeCom}, Error: ${error || 'No rows updated'}`)
    })
  }

  logger.log(`Successfully updated ${totalUpdated} rows in total.`)

  return results
}

export const getMultidistributed = async (districtCog: any) => Datanova.findOne({
  where: {inseeCom: districtCog},
  attributes: ['postalCodes'],
  raw: true
})