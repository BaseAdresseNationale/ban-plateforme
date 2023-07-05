const fetch = require('node-fetch')
const HttpsProxyAgent = require('https-proxy-agent')

const PROXY_URL = process.env.PROXY_URL || ''

class HTTPResponseError extends Error {
  constructor(response) {
    super(`HTTP Error Response: ${response.status} ${response.statusText}`)
    this.response = response
  }
}

const fetchWithProxy = async (url, options) => {
  try {
    let response
    if (PROXY_URL) {
      const agent = new HttpsProxyAgent(PROXY_URL)
      response = await fetch(url, {...options, agent})
    } else {
      response = await fetch(url, options)
    }

    if (response.status >= 400) {
      throw new HTTPResponseError(response)
    }

    return response
  } catch (error) {
    // Handle any network or other errors
    console.error(`Request failed : ${error.message}`)
    throw error
  }
}

module.exports = fetchWithProxy
