/* eslint-disable camelcase */

import os from 'node:os'
import MatomoTracker from 'matomo-tracker'

const {MATOMO_URL, MATOMO_SITE_ID, NODE_ENV} = process.env

let MATOMO_ERROR = false

let matomo

const isDevMode = () => NODE_ENV !== 'production'

const logMatomoError = err => {
  MATOMO_ERROR = true
  console.warn('[WARNING] tracking request:', err)
}

const matomoUrl = `${MATOMO_URL}/matomo.php`

try {
  const matomo = new MatomoTracker(MATOMO_SITE_ID, matomoUrl)
  matomo.on('error', logMatomoError)
} catch (error) {
  logMatomoError(error)
}

export const getTrackEvent = ({category, action, name, value}) => {
  const DEVMODE = isDevMode()

  // CF. Tracking HTTP API documentation :
  // https://developer.matomo.org/api-reference/tracking-api

  return {
    e_c: `${DEVMODE ? 'DEVMODE - ' : ''}${category}`, // Category name
    e_a: action, // Action name
    e_n: name, // Name
    ...(value ? {e_v: value} : {}), // Value
  }
}

export const sendToTracker = ({url, download, trackEvent}) =>
  !MATOMO_ERROR
  && matomo?.track({
    ua: `${os.hostname()} / Node.JS ${process.version} / ${os.version()}`,
    ...(url ? {url} : {}),
    ...(download ? {download} : {}),
    ...(trackEvent ? getTrackEvent(trackEvent) : {})
  })

export default sendToTracker
