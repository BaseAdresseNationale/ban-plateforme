import 'dotenv/config.js' // eslint-disable-line import/no-unassigned-import
import {customAlphabet} from 'nanoid'
import express from 'express'
import queue from '../../util/queue.cjs'
import auth from '../../middleware/auth.js'

const apiQueue = queue('api')

const BAN_API_URL
  = process.env.BAN_API_URL || 'https://plateforme.adresse.data.gouv.fr/api'

const nanoid = customAlphabet('123456789ABCDEFGHJKMNPQRSTVWXYZ', 9)

const app = new express.Router()

app.route('/')
  .put(auth, async (req, res) => {
    let response
    try {
      const postalAreas = req.body || {}
      const statusID = nanoid()

      await apiQueue.add(
        {dataType: 'postalArea', jobType: 'update', data: postalAreas, statusID},
        {jobId: statusID, removeOnComplete: true}
      )
      response = {
        date: new Date(),
        status: 'success',
        message: `Check the status of your request : ${BAN_API_URL}/job-status/${statusID}`,
        response: {statusID},
      }
    } catch (error) {
      response = {
        date: new Date(),
        status: 'error',
        message: error,
        response: {},
      }
    }

    res.send(response)
  })

export default app
