import 'dotenv/config.js' // eslint-disable-line import/no-unassigned-import
import {customAlphabet} from 'nanoid'
import express from 'express'
import queue from '../../util/queue.cjs'
import auth from '../../middleware/auth.js'
import {getAddress, deleteAddress} from './models.js'
import {getDeltaReport} from './utils.js'

const apiQueue = queue('api')

const BAN_API_URL
  = process.env.BAN_API_URL || 'https://plateforme.adresse.data.gouv.fr/api'

const nanoid = customAlphabet('123456789ABCDEFGHJKMNPQRSTVWXYZ', 9)

const app = new express.Router()

app.get('/:addressID', async (req, res) => {
  let response
  try {
    const {addressID} = req.params
    const address = await getAddress(addressID)

    if (!address) {
      res.status(404).send('Request ID unknown')
      return
    }

    response = {
      date: new Date(),
      status: 'success',
      response: address,
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

app.post('/', auth, async (req, res) => {
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

app.put('/', auth, async (req, res) => {
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

app.delete('/:addressID', auth, async (req, res) => {
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

app.post('/delete', auth, async (req, res) => {
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

app.post('/delta-report', auth, async (req, res) => {
  let response
  try {
    const {addressIDs, districtID} = req.body

    if (!addressIDs || !districtID) {
      res.status(404).send('Wrong request format')
      return
    }

    const deltaReport = await getDeltaReport(addressIDs, districtID)
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
