import 'dotenv/config.js' // eslint-disable-line import/no-unassigned-import
import express from 'express'
import auth from '../../middleware/auth.js'
import {updateMultipleDatanova} from './models.js'

const app = new express.Router()
app.use(express.json())

app.put('/', auth, async (req, res) => {
  try {
    const items = req.body

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({message: 'An array of items is required'})
    }

    const results = await updateMultipleDatanova(items)

    const totalUpdated = results.reduce((acc, {updatedRowsCount}) => acc + updatedRowsCount, 0)
    const failedUpdates = results.filter(({updatedRowsCount, error}) => updatedRowsCount === 0 || error)

    if (failedUpdates.length > 0) {
      return res.status(207).json({
        message: 'Partial success',
        totalUpdated,
        failedUpdates: failedUpdates.map(({inseeCom, error}) => ({inseeCom, error}))
      })
    }

    res.status(200).json({message: 'Records updated successfully', totalUpdated})
  } catch (error) {
    console.error('Error updating records:', error)
    res.status(500).json({message: 'Failed to update records', error: error.message})
  }
})

export default app
