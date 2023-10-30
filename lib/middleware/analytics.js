import {sendToTracker} from '../util/analytics-tracker.js'

const {NODE_ENV} = process.env
const isDevMode = () => NODE_ENV !== 'production'
const getSubApiFromBaseURL = baseUrl => [...baseUrl.replace(/^\//, '').split('/')].reverse()[0]

export const methodToDefaultAction = {
  GET: 'Lecture',
  POST: 'Création',
  PUT: 'Modification',
  PATCH: 'Modification partielle',
  DELETE: 'Suppression Unique',
}

const getSpecialAction = (url = '', method) => {
  const isNotValidMethod = (validMethode, methode) => validMethode !== methode
  const specialAction = url.replace(/^\//, '').split('/')
  switch (specialAction[0]) {
    case 'cog':
      return `Demande de conversion COG-to-District${isNotValidMethod('GET', method) ? ` [INVALID_METHOD (GET): reveived ${method}]` : ''}`
    case 'delta-report':
      return `Demande de rapport delta${isNotValidMethod('POST', method) ? ` [INVALID_METHOD (POST): reveived ${method}]` : ''}`
    case 'delete':
      return `Suppression Multiple${isNotValidMethod('POST', method) ? ` [INVALID_METHOD (POST): reveived ${method}]` : ''}`
    default:
      return null
  }
}

const getEventAction = ({method, url = ''}, isError) => {
  const action = getSpecialAction(url, method) || methodToDefaultAction[method] || `${method} to ${url.replace(/^\//, '')?.split('/')?.[0] || '/'}`
  return `${isError ? 'ERROR ON ' : ''}${action}: ${url}`
}

export const analyticsMiddleware = (req, res, next) => {
  const {url, baseUrl, method} = req
  const categoryName = 'Call API BAN'
  const actionName = getEventAction({url, baseUrl, method})
  const eventName = getSubApiFromBaseURL(baseUrl)

  const trackEvent = {
    category: categoryName,
    action: actionName,
    name: eventName,
    value: 1,
  }

  if (isDevMode()) {
    console.info('sendToTracker >>>', [...baseUrl.split('/')].reverse()[0], {url, trackEvent})
  }

  sendToTracker({url, trackEvent})
  next?.()
}

export const analyticsErrorMiddleware = ({req, error}) => {
  const {url, method} = req
  const actionName = getEventAction({method, url}, true)
  const trackEvent = {action: actionName}

  if (isDevMode()) {
    console.warn('sendToTracker // ERROR >>>', {url, trackEvent}, error)
  }

  sendToTracker({url, trackEvent})
}

export default analyticsMiddleware
