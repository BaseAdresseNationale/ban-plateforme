import express from 'express'
import postalDatanovaRoutes from './postal-datanova/route.js'
import postalAreaRoutes from './postal-area/route.js'
import postalCodeLongLatRoutes from './postal-code-long-lat/route.js'
const app = express.Router()

app.use('/postal-datanova', postalDatanovaRoutes)
app.use('/postal-area', postalAreaRoutes)
app.use('/long-lat-insee-com', postalCodeLongLatRoutes)
export default app