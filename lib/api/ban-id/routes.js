import 'dotenv/config.js' // eslint-disable-line import/no-unassigned-import
import express from 'express'
import analyticsMiddleware from '../../middleware/analytics.js'

import {handleAPIResponse} from '../helper.js'
import {getUuids, uncollidUuids} from './helpers.js'

const app = new express.Router()

app.get('/', analyticsMiddleware, async (req, res) => {
  try {
    const length = Number(req.query.quantity) || 1
    if (length > 100_000) {
      handleAPIResponse(res, 400, 'Quantity must be less than 100 000', {})
      return
    }

    const ids = await uncollidUuids(getUuids(length))
    handleAPIResponse(res, 200, 'Successfully generated UUIDs', ids)
  } catch (error) {
    console.error(error)
    handleAPIResponse(res, 500, 'Internal server error', {})
  }
})

export default app
