import {PostalArea, sequelize} from '../../util/sequelize.js'

interface PostalAreaChanges {
  postalCode: string
  geometry: string
  updatedBy?: string
  updateNote?: string
}


export const replacePostalAreasPerDistrictCog = async (cog: string, postalAreas: PostalAreaChanges[]) => {
  const formattedPostalAreas = postalAreas.map(({postalCode, geometry, updatedBy, updateNote}) => ({
    inseeCom: cog,
    postalCode,
    geometry: JSON.stringify(geometry),
    updatedBy,
    updateNote,
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
      INSERT INTO postal.postal_area ("postalCode", "inseeCom", geometry, "updatedBy", "updateNote", "createdAt", "updatedAt")
      VALUES ($1, $2, ST_SetSRID(ST_GeomFromGeoJSON($3), 2154), $4, $5, NOW(), NOW())
    `

    const insertPromises = formattedPostalAreas.map(async ({postalCode, inseeCom, geometry, updatedBy, updateNote}) => {
      const result = await sequelize.query(insertQuery, {
        bind: [postalCode, inseeCom, geometry, updatedBy, updateNote],
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
