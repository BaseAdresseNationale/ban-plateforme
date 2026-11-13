import 'dotenv/config.js' // eslint-disable-line import/no-unassigned-import
import express from 'express'

import fullRoutes from './full/full.js'
import diffRoutes from './diff/diff.js'

const app = express.Router()

app.use('/full', fullRoutes);
app.use('/diff', diffRoutes);

export default app
