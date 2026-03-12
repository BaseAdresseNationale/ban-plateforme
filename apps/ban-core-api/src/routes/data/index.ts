import 'dotenv/config.js' // eslint-disable-line import/no-unassigned-import
import express from 'express'

const app = express.Router()

import banRoutes from './ban.js'
import diffRoutes from './diff.js'

app.use('/ban', banRoutes);
app.use('/diff', diffRoutes);

export default app
