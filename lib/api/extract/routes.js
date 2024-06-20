import express from 'express'
import {streamBanDataFromCog, testIsEnabledCog} from './models.js'

const app = new express.Router()

app.get('/cog/:cog?', async (req, res) => {
  let response
  try {
    const {cog} = req.params
    const cogList = cog && [cog]
    const fileName = cog ? `ban_${cog}.json` : 'ban_france.json'

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
})

export default app
