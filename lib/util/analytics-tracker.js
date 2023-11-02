/* eslint-disable camelcase */

// CF. Tracking HTTP API documentation :
// https://developer.matomo.org/api-reference/tracking-api

import os from 'node:os'
import fetch from '../util/fetch.cjs'

const {
  MATOMO_URL,
  MATOMO_SITE_ID,
  MATOMO_TOKEN_AUTH,
  NODE_ENV
} = process.env
const isDevMode = NODE_ENV !== 'production'
const matomoUrl = `${MATOMO_URL}/matomo.php`

const logMatomoError = err => {
  console.log('error tracking request:', err)
}

const encodeParams = params => Object.fromEntries(
  Object
    .entries(params || {})
    .map(([key, value]) => [key, typeof value === 'string' ? encodeURIComponent(value) : value]),
)

export const getTrackEvent = ({category, action, name, value = 1}) => ({
  e_c: encodeURIComponent(`${isDevMode ? 'DEVMODE - ' : ''}${category}`), // Category name
  e_a: encodeURIComponent(action), // Action name
  e_n: encodeURIComponent(name), // Name
  e_v: value, // Value
})

export const sendToTracker = async (params = {}) => {
  const {url, ua, download, trackEvent, ...otherParams} = params
  const safeOtherParams = encodeParams(otherParams)
  const requiredParams = {
    idsite: MATOMO_SITE_ID,
    rec: 1,
    ua: ua || encodeURIComponent(`${os.hostname()} / Node.JS ${process.version} / ${os.version()}`),
    ...(MATOMO_TOKEN_AUTH ? {token_auth: MATOMO_TOKEN_AUTH} : {}),
  }
  const urlSearchParams = new URLSearchParams({
    ...requiredParams,
    ...safeOtherParams,
    ...(url ? {url: encodeURIComponent(url)} : {}),
    ...(download ? {download: encodeURIComponent(download)} : {}),
    ...(trackEvent ? getTrackEvent(trackEvent) : {}),
  })

  try {
    const sentToMatomoWithHTTP = await fetch(matomoUrl, {
      method: 'POST',
      body: urlSearchParams,
    })

    if (sentToMatomoWithHTTP.status !== 200) {
      throw new Error(`Matomo HTTP API returned ${sentToMatomoWithHTTP.status}`)
    }
  } catch (error) {
    logMatomoError(error)
  }
}

export default sendToTracker
