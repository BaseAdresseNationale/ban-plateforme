import 'dotenv/config.js' // eslint-disable-line import/no-unassigned-import
import express from 'express'

const app = express.Router()

import banRoutes from './ban.js'

app.use('/ban', banRoutes);

export default app
