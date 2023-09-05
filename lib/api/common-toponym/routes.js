import 'dotenv/config.js' // eslint-disable-line import/no-unassigned-import
import {customAlphabet} from 'nanoid'
import express from 'express'
import queue from '../../util/queue.cjs'
import auth from '../../middleware/auth.js'
import analyticsMiddleware from '../../middleware/analytics.js'
import {getCommonToponym, deleteCommonToponym} from './models.js'
import {getDeltaReport} from './utils.js'

const apiQueue = queue('api')

const BAN_API_URL
  = process.env.BAN_API_URL || 'https://plateforme.adresse.data.gouv.fr/api'

const nanoid = customAlphabet('123456789ABCDEFGHJKMNPQRSTVWXYZ', 9)

const app = new express.Router()

app.route('/')
  .post(auth, analyticsMiddleware, async (req, res) => {
    let response
    try {
      const commonToponyms = req.body
      const statusID = nanoid()

      await apiQueue.add(
        {dataType: 'commonToponym', jobType: 'insert', data: commonToponyms, statusID},
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
      const commonToponyms = req.body
      const statusID = nanoid()

      await apiQueue.add(
        {dataType: 'commonToponym', jobType: 'update', data: commonToponyms, statusID},
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

app.route('/:commonToponymID')
  .get(analyticsMiddleware, async (req, res) => {
    let response
    try {
      const {commonToponymID} = req.params
      const commonToponym = await getCommonToponym(commonToponymID)

      if (!commonToponym) {
        res.status(404).send('Request ID unknown')
        return
      }

      response = {
        date: new Date(),
        status: 'success',
        response: commonToponym,
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
      const {commonToponymID} = req.params
      const commonToponym = await getCommonToponym(commonToponymID)

      if (!commonToponym) {
        res.status(404).send('Request ID unknown')
        return
      }

      await deleteCommonToponym(commonToponymID)
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
    const commonToponymIDs = req.body
    const statusID = nanoid()

    await apiQueue.add(
      {dataType: 'commonToponym', jobType: 'delete', data: commonToponymIDs, statusID},
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
    const {commonToponymIDs, districtID} = req.body

    if (!commonToponymIDs || !districtID) {
      res.status(404).send('Wrong request format')
      return
    }

    const deltaReport = await getDeltaReport(commonToponymIDs, districtID)
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
