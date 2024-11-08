import 'dotenv/config.js' // eslint-disable-line import/no-unassigned-import
import {customAlphabet} from 'nanoid'
import express from 'express'
import queue from '../../util/queue.cjs'
import auth from '../../middleware/auth.js'
import analyticsMiddleware from '../../middleware/analytics.js'
import {handleAPIResponse} from '../helper.js'
import {getCommonToponym, deleteCommonToponym} from './models.js'
import {getDeltaReport, formatCommonToponym} from './utils.js'

const apiQueue = queue('api')

const BAN_API_URL
  = process.env.BAN_API_URL || 'https://plateforme.adresse.data.gouv.fr/api'

const nanoid = customAlphabet('123456789ABCDEFGHJKMNPQRSTVWXYZ', 9)

const app = new express.Router()

app.route('/')
  .post(auth, analyticsMiddleware, async (req, res) => {
    try {
      const commonToponyms = req.body
      if (!Array.isArray(commonToponyms)) {
        handleAPIResponse(res, 400, 'Wrong request format', {})
        return
      }

      const statusID = nanoid()
      await apiQueue.add(
        {dataType: 'commonToponym', jobType: 'insert', data: commonToponyms, statusID},
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
      const commonToponyms = req.body
      if (!Array.isArray(commonToponyms)) {
        handleAPIResponse(res, 400, 'Wrong request format', {})
        return
      }

      const statusID = nanoid()
      await apiQueue.add(
        {dataType: 'commonToponym', jobType: 'update', data: commonToponyms, statusID},
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
      const commonToponyms = req.body
      if (!Array.isArray(commonToponyms)) {
        handleAPIResponse(res, 400, 'Wrong request format', {})
        return
      }

      const statusID = nanoid()
      await apiQueue.add(
        {dataType: 'commonToponym', jobType: 'patch', data: commonToponyms, statusID},
        {jobId: statusID, removeOnComplete: true}
      )
      handleAPIResponse(res, 200, `Check the status of your request : ${BAN_API_URL}/job-status/${statusID}`, {statusID})
    } catch (error) {
      console.error(error)
      handleAPIResponse(res, 500, 'Internal server error', {})
    }
  })

app.route('/:commonToponymID')
  .get(analyticsMiddleware, async (req, res) => {
    try {
      const {commonToponymID} = req.params
      if (!commonToponymID) {
        handleAPIResponse(res, 400, 'Wrong request format', {})
        return
      }

      const commonToponym = await getCommonToponym(commonToponymID)
      if (!commonToponym) {
        handleAPIResponse(res, 404, 'Request ID unknown', {})
        return
      }

      const commonToponymFormatted = formatCommonToponym(commonToponym)
      handleAPIResponse(res, 200, 'Common toponym successfully retrieved', commonToponymFormatted)
    } catch (error) {
      console.error(error)
      handleAPIResponse(res, 500, 'Internal server error', {})
    }
  })
  .delete(auth, analyticsMiddleware, async (req, res) => {
    try {
      const {commonToponymID} = req.params
      if (!commonToponymID) {
        handleAPIResponse(res, 400, 'Wrong request format', {})
        return
      }

      const commonToponym = await getCommonToponym(commonToponymID)
      if (!commonToponym) {
        handleAPIResponse(res, 404, 'Request ID unknown', {})
        return
      }

      await deleteCommonToponym(commonToponymID)
      handleAPIResponse(res, 200, 'Common toponym successfully deleted', {})
    } catch (error) {
      console.error(error)
      handleAPIResponse(res, 500, 'Internal server error', {})
    }
  })

app.post('/delete', auth, analyticsMiddleware, async (req, res) => {
  try {
    const commonToponymIDs = req.body
    if (!Array.isArray(commonToponymIDs)) {
      handleAPIResponse(res, 400, 'Wrong request format', {})
      return
    }

    const statusID = nanoid()
    await apiQueue.add(
      {dataType: 'commonToponym', jobType: 'delete', data: commonToponymIDs, statusID},
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
    handleAPIResponse(res, 200, 'Delta report generated', deltaReport)
  } catch (error) {
    console.error(error)
    handleAPIResponse(res, 500, 'Internal server error', {})
  }
})

export default app
