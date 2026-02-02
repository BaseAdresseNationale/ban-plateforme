import express from 'express'
import {streamBanDataFromCog, testIsEnabledCog} from './models.js'

const app = new express.Router()

const banFormatMiddleware = async (req, res, next) => {
  let response
  try {
    const {cogList} = req.params
    const fileName = cogList ? `ban_${cogList.join('_')}.json` : 'ban_france.json'

    const checkCog = (
      await Promise.all(
        (cogList || [])?.map(cog => testIsEnabledCog(cog))
      )
    ).reduce((acc, isEnabled, index) => {
      const cog = cogList[index]
      if (isEnabled) {
        acc.OK.push(cog)
      } else {
        acc.KO.push(cog)
      }

      return acc
    }, {OK: [], KO: []})

    if (checkCog.KO.length > 0) {
      response = {
        status: 'error',
        message: `[Disabled COG] ${checkCog.KO.length <= 1 ? 'This COG is' : 'This/These COG are'} not enabled: ${checkCog.KO.join(', ')}`,
        value: checkCog,
      }
      res.status(400)
      res.send(response)
      return
    }

    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)
    await streamBanDataFromCog(res)(cogList)
    res.end()
    return
  } catch (error) {
    const {message} = error
    response = {
      status: 'error',
      message,
    }
  }

  res.send(response)

  next()
}

app.get(
  '/cog/:cog?',
  (req, res, next) => {
    const {cog} = req.params
    req.params.cogList = cog ? [cog] : null
    next()
  },
  banFormatMiddleware
)
app.post(
  '/cog',
  (req, res, next) => {
    req.params.cogList = req.body.cogList.map(cog => cog.toString().padStart(5, '0'))
    next()
  },
  banFormatMiddleware
)

export default app
