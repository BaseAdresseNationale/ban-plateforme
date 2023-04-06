import 'dotenv/config.js' // eslint-disable-line import/no-unassigned-import
import {customAlphabet} from 'nanoid'
import express from 'express'
import queue from '../../util/queue.cjs'
import auth from '../../middleware/auth.js'
import {getRoad, deleteRoad} from './models.js'

const apiQueue = queue('api')

const BAN_API_URL
  = process.env.BAN_API_URL || 'https://plateforme.adresse.data.gouv.fr'

const nanoid = customAlphabet('123456789ABCDEFGHJKMNPQRSTVWXYZ', 9)

const app = new express.Router()
app.use(express.json())

app.get('/:roadID', async (req, res) => {
  let response
  try {
    const {roadID} = req.params
    const road = await getRoad(roadID)

    if (!road) {
      res.status(404).send('Request ID unknown')
      return
    }

    const {_id, ...roadBody} = road
    response = {
      date: new Date(),
      status: 'success',
      response: {...roadBody},
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
    const roads = req.body
    const statusID = nanoid()

    await apiQueue.add(
      {dataType: 'road', jobType: 'insert', data: roads, statusID},
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
    const roads = req.body
    const statusID = nanoid()

    await apiQueue.add(
      {dataType: 'road', jobType: 'update', data: roads, statusID},
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

app.delete('/:roadID', async (req, res) => {
  let response
  try {
    const {roadID} = req.params
    const road = await getRoad(roadID)

    if (!road) {
      res.status(404).send('Request ID unknown')
      return
    }

    await deleteRoad(roadID)
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

export default app
