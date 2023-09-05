import {sendToTracker} from '../util/analytics-tracker.js'

const getSubApiFromBaseURL = baseUrl => [...baseUrl.replace(/^\//, '').split('/')].reverse()[0]

const methodToDefaultAction = {
  GET: 'Lecture',
  POST: 'Création',
  PUT: 'Modification',
  DELETE: 'Suppression Unique',
}

const getSpecialAction = url => {
  const specialAction = url.split('/')
  switch (specialAction[0]) {
    case 'cog':
      return 'Demande de conversion COG-to-District'
    case 'delta-report':
      return 'Demande de rapport delta'
    case 'delete':
      return 'Suppression Multiple'
    default:
      return null
  }
}

const getEventAction = ({method, url}, isError) => {
  const action = getSpecialAction(url) || methodToDefaultAction[method] || `${method} to ${url.split('/')[0] || '/'}}`
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

  console.log('sendToTracker >>>', [...baseUrl.split('/')].reverse()[0], {url, trackEvent})
  sendToTracker({url, trackEvent})
  next?.()
}

export const analyticsErrorMiddleware = ({req, error}) => {
  const {url, method} = req
  const actionName = getEventAction({method, url}, true)
  const trackEvent = {action: actionName}
  console.log('sendToTracker // ERROR >>>', {url, trackEvent}, error)

  sendToTracker({url, trackEvent})
}

export default analyticsMiddleware
