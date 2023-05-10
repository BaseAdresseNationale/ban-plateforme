import 'dotenv/config.js' // eslint-disable-line import/no-unassigned-import
import express from 'express'
import {getUuids, uncollidUuids} from './helpers.js'

const app = new express.Router()
app.use(express.json())

app.get('/', async (req, res) => {
  let response
  try {
    const length = Number(req.query.quantity) || 1
    if (length > 100_000) {
      res.status(400).send({
        date: new Date(),
        status: 'error',
        message: 'Quantity must be less than 100 000',
        response: {},
      })
      return
    }

    const ids = await uncollidUuids(getUuids(length))

    response = {
      date: new Date(),
      status: 'success',
      response: ids,
    }
  } catch (error) {
    const {message} = error
    response = {
      date: new Date(),
      status: 'error',
      message,
      response: {},
    }
  }

  res.send(response)
})

export default app
