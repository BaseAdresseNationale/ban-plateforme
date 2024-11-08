import 'dotenv/config.js' // eslint-disable-line import/no-unassigned-import
import {customAlphabet} from 'nanoid'
import express from 'express'
import queue from '../../util/queue.cjs'
import auth from '../../middleware/auth.js'
import analyticsMiddleware from '../../middleware/analytics.js'
import {handleAPIResponse} from '../helper.js'
import {getAddress, deleteAddress} from './models.js'
import {getDeltaReport, formatAddress} from './utils.js'

const apiQueue = queue('api')

const BAN_API_URL
  = process.env.BAN_API_URL || 'https://plateforme.adresse.data.gouv.fr/api'

const nanoid = customAlphabet('123456789ABCDEFGHJKMNPQRSTVWXYZ', 9)

const app = new express.Router()

app.route('/')
  .post(auth, analyticsMiddleware, async (req, res) => {
    try {
      const addresses = req.body
      if (!Array.isArray(addresses)) {
        handleAPIResponse(res, 400, 'Wrong request format', {})
        return
      }

      const statusID = nanoid()
      await apiQueue.add(
        {dataType: 'address', jobType: 'insert', data: addresses, statusID},
        {jobId: statusID, removeOnComplete: true}
      )
      handleAPIResponse(res, 200, `Check the status of your request : ${BAN_API_URL}/job-status/${statusID}`, {statusID})
    } catch (error) {
      console.error(error)
      handleAPIResponse(res, 500, 'Internal server error', {})
    }
  })
  .put(auth, analyticsMiddleware, async (req, res) => {
    try {
      const addresses = req.body
      if (!Array.isArray(addresses)) {
        handleAPIResponse(res, 400, 'Wrong request format', {})
        return
      }

      const statusID = nanoid()
      await apiQueue.add(
        {dataType: 'address', jobType: 'update', data: addresses, statusID},
        {jobId: statusID, removeOnComplete: true}
      )
      handleAPIResponse(res, 200, `Check the status of your request : ${BAN_API_URL}/job-status/${statusID}`, {statusID})
    } catch (error) {
      console.error(error)
      handleAPIResponse(res, 500, 'Internal server error', {})
    }
  })
  .patch(auth, analyticsMiddleware, async (req, res) => {
    try {
      const addresses = req.body
      if (!Array.isArray(addresses)) {
        handleAPIResponse(res, 400, 'Wrong request format', {})
        return
      }

      const statusID = nanoid()
      await apiQueue.add(
        {dataType: 'address', jobType: 'patch', data: addresses, statusID},
        {jobId: statusID, removeOnComplete: true}
      )
      handleAPIResponse(res, 200, `Check the status of your request : ${BAN_API_URL}/job-status/${statusID}`, {statusID})
    } catch (error) {
      console.error(error)
      handleAPIResponse(res, 500, 'Internal server error', {})
    }
  })

app.route('/:addressID')
  .get(analyticsMiddleware, async (req, res) => {
    try {
      const {addressID} = req.params
      if (!addressID) {
        handleAPIResponse(res, 400, 'Wrong request format', {})
        return
      }

      const address = await getAddress(addressID)
      if (!address) {
        handleAPIResponse(res, 404, 'Request ID unknown', {})
        return
      }

      const addressFormatted = formatAddress(address)
      handleAPIResponse(res, 200, 'Address successfully retrieved', addressFormatted)
    } catch (error) {
      console.error(error)
      handleAPIResponse(res, 500, 'Internal server error', {})
    }
  })
  .delete(auth, analyticsMiddleware, async (req, res) => {
    try {
      const {addressID} = req.params
      const address = await getAddress(addressID)

      if (!address) {
        handleAPIResponse(res, 404, 'Request ID unknown', {})
        return
      }

      await deleteAddress(addressID)
      handleAPIResponse(res, 200, 'Address successfully deleted', {})
    } catch (error) {
      console.error(error)
      handleAPIResponse(res, 500, 'Internal server error', {})
    }
  })

app.post('/delete', auth, analyticsMiddleware, async (req, res) => {
  try {
    const addressIDs = req.body
    if (!Array.isArray(addressIDs)) {
      handleAPIResponse(res, 400, 'Wrong request format', {})
      return
    }

    const statusID = nanoid()

    await apiQueue.add(
      {dataType: 'address', jobType: 'delete', data: addressIDs, statusID},
      {jobId: statusID, removeOnComplete: true}
    )
    handleAPIResponse(res, 200, `Check the status of your request : ${BAN_API_URL}/job-status/${statusID}`, {statusID})
  } catch (error) {
    console.error(error)
    handleAPIResponse(res, 500, 'Internal server error', {})
  }
})

app.post('/delta-report', auth, analyticsMiddleware, async (req, res) => {
  try {
    const {data, districtID} = req.body
    if (!data || !districtID) {
      handleAPIResponse(res, 400, 'Wrong request format', {})
      return
    }

    const deltaReport = await getDeltaReport(data, districtID)
    handleAPIResponse(res, 200, 'Delta report successfully generated', deltaReport)
  } catch (error) {
    console.error(error)
    handleAPIResponse(res, 500, 'Internal server error', {})
  }
})

export default app
