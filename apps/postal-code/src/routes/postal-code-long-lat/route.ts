import express from 'express'
import auth from '../../util/auth.js'
import {handleApiResponse} from '@ban/tools'
import getPostalCode from './model.js'


const app = express.Router()
app.use(express.json())

app.get('/:inseeCom?/:long?/:lat?', auth, async (req, res) => {
  try {
    const { inseeCom, long, lat } = req.query
    if (!inseeCom && !(long && lat)) {
      handleApiResponse(res, 400, 'Long/lat ou inseeCom are required or both', {})
      return
    }
    const results = await getPostalCode.getPostalCode(long?.toString(), lat?.toString(), inseeCom?.toString())

    handleApiResponse(res, 200, '[postal-code-service] Postal code request processed successfully', results)
    return
  } catch (error) {
    handleApiResponse(res, 400, '[postal-code-service] ' + (error as Error).message, {})
  }
})

export default app
