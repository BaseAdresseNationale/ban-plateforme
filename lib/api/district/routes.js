import 'dotenv/config.js' // eslint-disable-line import/no-unassigned-import
import {customAlphabet} from 'nanoid'
import express from 'express'
import queue from '../../util/queue.cjs'
import auth from '../../middleware/auth.js'
import analyticsMiddleware from '../../middleware/analytics.js'
import {handleAPIResponse} from '../helper.js'
import {getDistrict, getDistrictsFromCog, deleteDistrict} from './models.js'
import {formatDistrict} from './utils.js'

const apiQueue = queue('api')

const BAN_API_URL
  = process.env.BAN_API_URL || 'https://plateforme.adresse.data.gouv.fr/api'

const nanoid = customAlphabet('123456789ABCDEFGHJKMNPQRSTVWXYZ', 9)

const app = new express.Router()

app.route('/')
  .post(auth, analyticsMiddleware, async (req, res) => {
    try {
      const districts = req.body
      if (!Array.isArray(districts)) {
        handleAPIResponse(res, 400, 'Wrong request format', {})
        return
      }

      const statusID = nanoid()
      await apiQueue.add(
        {dataType: 'district', jobType: 'insert', data: districts, statusID},
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
      const districts = req.body
      if (!Array.isArray(districts)) {
        handleAPIResponse(res, 400, 'Wrong request format', {})
        return
      }

      const statusID = nanoid()
      await apiQueue.add(
        {dataType: 'district', jobType: 'update', data: districts, statusID},
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
      const districts = req.body
      if (!Array.isArray(districts)) {
        handleAPIResponse(res, 400, 'Wrong request format', {})
        return
      }

      const statusID = nanoid()
      await apiQueue.add(
        {dataType: 'district', jobType: 'patch', data: districts, statusID},
        {jobId: statusID, removeOnComplete: true}
      )
      handleAPIResponse(res, 200, `Check the status of your request : ${BAN_API_URL}/job-status/${statusID}`, {statusID})
    } catch (error) {
      console.error(error)
      handleAPIResponse(res, 500, 'Internal server error', {})
    }
  })

app.route('/:districtID')
  .get(analyticsMiddleware, async (req, res) => {
    try {
      const {districtID} = req.params
      if (!districtID) {
        handleAPIResponse(res, 400, 'Wrong request format', {})
        return
      }

      const district = await getDistrict(districtID)
      if (!district) {
        handleAPIResponse(res, 404, 'Request ID unknown', {})
        return
      }

      const districtFormatted = formatDistrict(district)
      handleAPIResponse(res, 200, 'District successfilly retrieved', districtFormatted)
    } catch (error) {
      console.error(error)
      handleAPIResponse(res, 500, 'Internal server error', {})
    }
  })
  .delete(auth, analyticsMiddleware, async (req, res) => {
    try {
      const {districtID} = req.params
      if (!districtID) {
        handleAPIResponse(res, 400, 'Wrong request format', {})
        return
      }

      const district = await getDistrict(districtID)
      if (!district) {
        handleAPIResponse(res, 404, 'Request ID unknown', {})
        return
      }

      await deleteDistrict(districtID)
      handleAPIResponse(res, 200, 'District successfully deleted', {})
    } catch (error) {
      console.error(error)
      handleAPIResponse(res, 500, 'Internal server error', {})
    }
  })

app.post('/delete', auth, analyticsMiddleware, async (req, res) => {
  try {
    const districtIDs = req.body
    if (!Array.isArray(districtIDs)) {
      handleAPIResponse(res, 400, 'Wrong request format', {})
      return
    }

    const statusID = nanoid()
    await apiQueue.add(
      {dataType: 'district', jobType: 'delete', data: districtIDs, statusID},
      {jobId: statusID, removeOnComplete: true}
    )
    handleAPIResponse(res, 200, `Check the status of your request : ${BAN_API_URL}/job-status/${statusID}`, {statusID})
  } catch (error) {
    console.error(error)
    handleAPIResponse(res, 500, 'Internal server error', {})
  }
})

app.get('/cog/:cog', analyticsMiddleware, async (req, res) => {
  try {
    const {cog} = req.params
    if (!cog) {
      handleAPIResponse(res, 400, 'Wrong request format', {})
      return
    }

    const districts = await getDistrictsFromCog(cog)
    if (!districts || districts.length === 0) {
      handleAPIResponse(res, 404, 'Request ID unknown', {})
      return
    }

    const districtBodies = districts.map(district => formatDistrict(district))
    handleAPIResponse(res, 200, 'Districts successfully retrieved', districtBodies)
  } catch (error) {
    console.error(error)
    handleAPIResponse(res, 500, 'Internal server error', {})
  }
})

export default app
