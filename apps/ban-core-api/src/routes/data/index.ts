import 'dotenv/config.js' // eslint-disable-line import/no-unassigned-import
import express from 'express'

import banRoutes from './ban/ban.js'
import diffRoutes from './diff/diff.js'

const app = express.Router()

app.use('/ban', banRoutes);
app.use('/diff', diffRoutes);

export default app
