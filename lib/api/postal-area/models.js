import {PostalArea, sequelize} from '../../util/sequelize.js'

export const replacePostalAreasPerDistrictCog = async (cog, postalAreas) => {
  const formattedPostalAreas = postalAreas.map(({postalCode, geometry}) => ({
    inseeCom: cog,
    postalCode,
    geometry: JSON.stringify(geometry),
  }))

  const transaction = await sequelize.transaction()

  try {
    const postalAreasDeletedCount = await PostalArea.destroy(
      {
        where: {inseeCom: cog},
        transaction,
      }
    )

    const insertQuery = `
      INSERT INTO external.postal_area ("postalCode", "inseeCom", geometry, "createdAt", "updatedAt")
      VALUES ($1, $2, ST_SetSRID(ST_GeomFromGeoJSON($3), 2154), NOW(), NOW())
    `

    const insertPromises = formattedPostalAreas.map(async ({postalCode, inseeCom, geometry}) => {
      const result = await sequelize.query(insertQuery, {
        bind: [postalCode, inseeCom, geometry],
        transaction,
      })
      if (result[1] !== 1) {
        throw new Error(`Failed to insert postal area with postalCode: ${postalCode}`)
      }
    })

    await Promise.all(insertPromises)

    await transaction.commit()

    return {postalAreasCreatedCount: formattedPostalAreas.length, postalAreasDeletedCount}
  } catch (error) {
    await transaction.rollback()
    throw error
  }
}
