import express from 'express'
import swaggerUi from 'swagger-ui-express'
import specs from './swaggerConfig.js'
import addressRoutes from './address/routes.js'
import commonToponymRoutes from './common-toponym/routes.js'
import districtRoutes from './district/routes.js'
import statusRoutes from './job-status/routes.js'
import banIdRoutes from './ban-id/routes.js'
import certificatRoutes from './certificate/routes.js'
import postalDatanovaRoutes from './postal-datanova/routes.js'
import postalAreaRoutes from './postal-area/routes.js'
import exportToExploitationDBRoutes from './export-to-exploitation-db/routes.js'
const app = new express.Router()

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs))
app.use('/address', addressRoutes)
app.use('/common-toponym', commonToponymRoutes)
app.use('/district', districtRoutes)
app.use('/job-status', statusRoutes)
app.use('/ban-id', banIdRoutes)
app.use('/certificate', certificatRoutes)
app.use('/postal-datanova', postalDatanovaRoutes)
app.use('/postal-area', postalAreaRoutes)
app.use('/export-to-exploitation-db', exportToExploitationDBRoutes)

export default app
