import {Datanova} from '../../util/sequelize.js'

export const updateDatanova = async ({postalCodes, libelleAcheminementWithPostalCodes, inseeCom}) => {
  try {
    const [updatedRowsCount] = await Datanova.update(
      {
        postalCodes,
        libelleAcheminementWithPostalCodes,
        updatedAt: new Date(),
      },
      {where: {inseeCom}}
    )
    return {inseeCom, updatedRowsCount}
  } catch (error) {
    return {inseeCom, error: error.message}
  }
}

export const updateMultipleDatanova = async items => {
  console.log('Start postal-datanova updated')
  // eslint-disable-next-line unicorn/no-array-callback-reference
  const results = await Promise.all(items.map(updateDatanova))

  const totalUpdated = results.reduce((acc, {updatedRowsCount}) => acc + updatedRowsCount, 0)

  const errors = results.filter(({updatedRowsCount, error}) => updatedRowsCount === 0 || error)
  if (errors.length > 0) {
    console.error('The following records were not updated:')
    errors.forEach(({inseeCom, error}) => {
      console.error(`- inseeCom: ${inseeCom}, Error: ${error || 'No rows updated'}`)
    })
  }

  console.log(`Successfully updated ${totalUpdated} rows in total.`)

  return results
}
