const fetch = require('../util/fetch.cjs')

const {
  API_IDFIX_URL = '',
  API_IDFIX_TOKEN = '',
} = process.env

const idFixComputeFromCogs = async cogs => {
  try {
    const response = await fetch(`${API_IDFIX_URL}/compute-from-cogs`, {
      method: 'POST',
      body: JSON.stringify({cogs}),
      headers: {
        'content-Type': 'application/json',
        Authorization: `Token ${API_IDFIX_TOKEN}`,
      },
    })
    return response.json()
  } catch (error) {
    console.error(error)
  }
}

module.exports = {idFixComputeFromCogs}
