import 'dotenv/config.js' // eslint-disable-line import/no-unassigned-import
import {customAlphabet} from 'nanoid'
import express from 'express'
import Papa from 'papaparse'
import queue from '../../util/queue.cjs'
import auth from '../../middleware/auth.js'
import analyticsMiddleware from '../../middleware/analytics.js'
import fetch from '../../util/fetch.cjs'
import {getDistrict, getDistrictFromCog, getDistrictsFromCog, deleteDistrict, patchDistricts} from './models.js'

const apiQueue = queue('api')

const BAN_API_URL
  = process.env.BAN_API_URL || 'https://plateforme.adresse.data.gouv.fr/api'

const nanoid = customAlphabet('123456789ABCDEFGHJKMNPQRSTVWXYZ', 9)

const app = new express.Router()

app.route('/')
  .post(auth, analyticsMiddleware, async (req, res) => {
    let response
    try {
      const districts = req.body
      const statusID = nanoid()

      await apiQueue.add(
        {dataType: 'district', jobType: 'insert', data: districts, statusID},
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
      const districts = req.body
      const statusID = nanoid()

      await apiQueue.add(
        {dataType: 'district', jobType: 'update', data: districts, statusID},
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
      const districts = req.body
      const statusID = nanoid()

      await apiQueue.add(
        {dataType: 'district', jobType: 'patch', data: districts, statusID},
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

app.route('/:districtID')
  .get(analyticsMiddleware, async (req, res) => {
    let response
    try {
      const {districtID} = req.params
      const district = await getDistrict(districtID)

      if (!district) {
        res.status(404).send('Request ID unknown')
        return
      }

      response = {
        date: new Date(),
        status: 'success',
        response: district,
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
      const {districtID} = req.params
      const district = await getDistrict(districtID)

      if (!district) {
        res.status(404).send('Request ID unknown')
        return
      }

      await deleteDistrict(districtID)
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
    const districtIDs = req.body
    const statusID = nanoid()

    await apiQueue.add(
      {dataType: 'district', jobType: 'delete', data: districtIDs, statusID},
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

app.get('/cog/:cog', analyticsMiddleware, async (req, res) => {
  let response
  try {
    const {cog} = req.params
    const districts = await getDistrictFromCog(cog)

    if (!districts || districts.length === 0) {
      res.status(404).send('Request ID unknown')
      return
    }

    const districtBodies = districts.map(({_id, ...districtBody}) => districtBody)
    response = {
      date: new Date(),
      status: 'success',
      response: districtBodies,
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

async function updateDbFromDataNova(postalFile) {
  /* eslint-disable camelcase */
  const headers = {
    '#Code_commune_INSEE': 'codeInsee',
    Nom_de_la_commune: 'nomCommune',
    Code_postal: 'codePostal',
    Libellé_d_acheminement: 'libelleAcheminement',
    'Libell�_d_acheminement': 'libelleAcheminement', // Postal file url returns wrong header charset code (UTF-8 instead of ISO-8859-1)
    Ligne_5: 'ligne5',
  }
  /* eslint-enable camelcase */

  const dataRaw = await Papa.parse(postalFile, {
    header: true,
    transformHeader: name => headers[name] || name,
    skipEmptyLines: true,
  })

  const districts = await getDistrictsFromCog(
    dataRaw.data.map(({codeInsee}) => codeInsee)
  )

  const districtsByInseeCode = districts.reduce(
    (acc, district) => ({
      ...acc,
      ...(!district?.meta || acc[district.meta?.insee?.cog] ? {} : {[district.meta.insee.cog]: district}),
    }), {})

  const banDistricts = Object.values(
    (dataRaw?.data || []).map(({codeInsee, codePostal, libelleAcheminement}) => {
      const {id} = districtsByInseeCode[codeInsee] || {}
      return {id, codePostal: [codePostal], libelleAcheminement}
    })
      .reduce(
        (acc, district) => {
          if (district.id) {
            if (acc[district.id]) {
              acc[district.id].codePostal = [...acc[district.id].codePostal, ...district.codePostal]
            } else {
              acc[district.id] = district
            }
          }

          return acc
        }, {}
      )
  )

  const patchBulkOperations = banDistricts.map(({id, codePostal, libelleAcheminement}) => ({
    id,
    meta: {
      laPoste: {
        codePostal,
        libelleAcheminement,
        source: 'La Poste - dataNOVA',
      }
    }
  }))

  patchDistricts(patchBulkOperations)

  return banDistricts
}

app.route('/codePostal')
  .get(async (req, res) => {
    let response
    try {
      // On February 2024 the postal file url is :
      // https://datanova.laposte.fr/data-fair/api/v1/datasets/laposte-hexasmal/raw
      const {url} = req.query
      const postalFile = await fetch(url)

      response = await updateDbFromDataNova(postalFile)
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
  .post(express.text(), async (req, res) => {
    let response
    try {
      const postalFile = req.body

      response = await updateDbFromDataNova(postalFile)
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
