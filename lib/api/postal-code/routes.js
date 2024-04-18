import 'dotenv/config.js' // eslint-disable-line import/no-unassigned-import
import express from 'express'
import auth from '../../middleware/auth.js'
import {getAllPostalAreas, putPostalAreas, deletePostalAreas} from './models.js'

const app = new express.Router()

app.route('/')
  .put(auth, async (req, res) => {
    const postalCodeDBResponse = await getAllPostalAreas() || []
    const postalCodesFromDB = new Set(postalCodeDBResponse.map(({postalCode}) => postalCode))

    const {features, crs} = req.body || {}

    const bulkOperations = features.map(({properties, geometry}) => {
      const postalCode = properties.cp
      postalCodesFromDB.delete(postalCode)
      if (geometry.crs === undefined) {
        geometry.crs = crs
      }

      return {postalCode, geometry}
    })

    const bulkPostalCode = putPostalAreas(bulkOperations)

    const deletePostalCode = postalCodesFromDB.size > 0 ? deletePostalAreas([...postalCodesFromDB]) : true

    const operations = await Promise.all([bulkPostalCode, deletePostalCode])

    res.send(
      {
        date: new Date(),
        status: 'success',
        response: operations,
      }
    )
  })

export default app
