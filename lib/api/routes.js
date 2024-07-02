
import express from 'express'

import addressRoutes from './address/routes.js'
import commonToponymRoutes from './common-toponym/routes.js'
import districtRoutes from './district/routes.js'
import statusRoutes from './job-status/routes.js'
import banIdRoutes from './ban-id/routes.js'
import extractRoutes from './extract/routes.js'

const app = new express.Router()

app.use('/address', addressRoutes)
app.use('/common-toponym', commonToponymRoutes)
app.use('/district', districtRoutes)
app.use('/job-status', statusRoutes)
app.use('/ban-id', banIdRoutes)
app.use('/extract', extractRoutes)

export default app
