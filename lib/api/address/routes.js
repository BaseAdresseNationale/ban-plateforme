import 'dotenv/config.js' // eslint-disable-line import/no-unassigned-import
import {customAlphabet} from 'nanoid'
import express from 'express'
import queue from '../../util/queue.cjs'
import auth from '../../middleware/auth.js'
import analyticsMiddleware from '../../middleware/analytics.js'
import {getAddress, deleteAddress} from './models.js'
import {getDeltaReport, formatAddress} from './utils.js'

const apiQueue = queue('api')

const BAN_API_URL
  = process.env.BAN_API_URL || 'https://plateforme.adresse.data.gouv.fr/api'

const nanoid = customAlphabet('123456789ABCDEFGHJKMNPQRSTVWXYZ', 9)

const app = new express.Router()

app.route('/')
  .post(auth, analyticsMiddleware, async (req, res) => {
    let response
    try {
      const addresses = req.body
      const statusID = nanoid()

      await apiQueue.add(
        {dataType: 'address', jobType: 'insert', data: addresses, statusID},
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
  .put(auth, analyticsMiddleware, async (req, res) => {
    let response
    try {
      const addresses = req.body
      const statusID = nanoid()

      await apiQueue.add(
        {dataType: 'address', jobType: 'update', data: addresses, statusID},
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
  .patch(auth, analyticsMiddleware, async (req, res) => {
    let response
    try {
      const addresses = req.body
      const statusID = nanoid()

      await apiQueue.add(
        {dataType: 'address', jobType: 'patch', data: addresses, statusID},
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

app.route('/:addressID')
  .get(analyticsMiddleware, async (req, res) => {
    let response
    try {
      const {addressID} = req.params
      const address = await getAddress(addressID)

      if (!address) {
        res.status(404).send('Request ID unknown')
        return
      }

      const addressFormatted = formatAddress(address)

      response = {
        date: new Date(),
        status: 'success',
        response: addressFormatted,
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
  .delete(auth, analyticsMiddleware, async (req, res) => {
    let response
    try {
      const {addressID} = req.params
      const address = await getAddress(addressID)

      if (!address) {
        res.status(404).send('Request ID unknown')
        return
      }

      await deleteAddress(addressID)
      response = {
        date: new Date(),
        status: 'success',
        response: {},
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

app.post('/delete', auth, analyticsMiddleware, async (req, res) => {
  let response
  try {
    const addressIDs = req.body
    const statusID = nanoid()

    await apiQueue.add(
      {dataType: 'address', jobType: 'delete', data: addressIDs, statusID},
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

app.post('/delta-report', auth, analyticsMiddleware, async (req, res) => {
  let response
  try {
    const {data, districtID} = req.body

    if (!data || !districtID) {
      res.status(404).send('Wrong request format')
      return
    }

    const deltaReport = await getDeltaReport(data, districtID)
    response = {
      date: new Date(),
      status: 'success',
      response: deltaReport,
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
