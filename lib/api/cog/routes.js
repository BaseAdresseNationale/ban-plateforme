import 'dotenv/config.js' // eslint-disable-line import/no-unassigned-import
import express from 'express'
import queue from '../../util/queue.cjs'
import auth from '../../middleware/auth.js'
import {handleAPIResponse} from '../helper.js'
import {getDistrict} from '../district/models.js'
import { dataCog2025 } from './cog_data/communes_nouvelles_2024_utf8.js'
import { District } from './sequelize.js'
import { formatDistrict } from '../api/district/utils.js'


const app = new express.Router()

  app.get('/', auth, async (req, res) => {
    try {
      const dataCog = dataCog2025
      if (!Array.isArray(dataCog)) {
        handleAPIResponse(res, 400, 'Wrong request format', {})
        return
      }
      for (const i in data){
        const districtMouvement = data[i]
    
        const district = await getDistrict(districtMouvement["DepComA"])
        const formatterdDistrict = formatDistrict(district)
        
        console.log(formatterdDistrict)
    
    }
  
      handleAPIResponse(res, 200, `This the data cog 2025`, dataCog)
    } catch (error) {
      console.error(error)
      handleAPIResponse(res, 500, 'Internal server error', {})
    }
  })

export default app

  
  const data = dataCog2025
