import 'dotenv/config.js' // eslint-disable-line import/no-unassigned-import
import express from 'express'
import auth from '../../middleware/auth.js'
import {handleAPIResponse} from '../helper.js'
import {updateMultipleDatanova} from './models.js'

const app = new express.Router()
app.use(express.json())

app.put('/', auth, async (req, res) => {
  try {
    const items = req.body

    if (!Array.isArray(items) || items.length === 0) {
      handleAPIResponse(res, 400, 'An array of items is required', {})
      return
    }

    const results = await updateMultipleDatanova(items)

    const totalUpdated = results.reduce((acc, {updatedRowsCount}) => acc + updatedRowsCount, 0)
    const failedUpdates = results.filter(({updatedRowsCount, error}) => updatedRowsCount === 0 || error)

    if (failedUpdates.length > 0) {
      handleAPIResponse(res, 207, 'Partial success', {
        totalUpdated,
        failedUpdates: failedUpdates.map(({inseeCom, error}) => ({inseeCom, error}))
      })
      return
    }

    handleAPIResponse(res, 200, 'Records updated successfully', {totalUpdated})
  } catch (error) {
    console.error(error)
    handleAPIResponse(res, 500, 'Internal server error', {})
  }
})

export default app
