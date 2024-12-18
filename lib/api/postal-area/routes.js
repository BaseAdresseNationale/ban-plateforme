import 'dotenv/config.js' // eslint-disable-line import/no-unassigned-import
import express from 'express'
import auth from '../../middleware/auth.js'
import {handleAPIResponse} from '../helper.js'
import {replacePostalAreasPerDistrictCog} from './models.js'

const app = new express.Router()
app.use(express.json())

app.put('/district/cog/:cog', auth, async (req, res) => {
  try {
    const {cog} = req.params
    const postalAreas = req.body

    if (!cog) {
      handleAPIResponse(res, 400, 'COG code is required', {})
      return
    }

    if (!Array.isArray(postalAreas) || postalAreas.length === 0) {
      handleAPIResponse(res, 400, 'An array of items is required', {})
      return
    }

    const {postalAreasCreatedCount, postalAreasDeletedCount} = await replacePostalAreasPerDistrictCog(cog, postalAreas)

    handleAPIResponse(res, 200, 'Postal areas updated', {
      createdCount: postalAreasCreatedCount,
      deletedCount: postalAreasDeletedCount,
    })
  } catch (error) {
    console.error(error)
    handleAPIResponse(res, 500, 'Internal server error', {})
  }
})

export default app
