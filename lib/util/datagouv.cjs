const FormData = require('form-data')
const fetch = require('./fetch.cjs')

async function replaceResourceFile(datasetId, resourceId, fileName, fileContent) {
  const url = `https://www.data.gouv.fr/api/1/datasets/${datasetId}/resources/${resourceId}/upload/`

  const fileBuffer = typeof fileContent === 'string' ? Buffer.from(fileContent) : fileContent

  const form = new FormData()
  form.append('file', fileBuffer, {filename: fileName})

  const fetchOptions = {
    method: 'POST',
    headers: {
      'X-API-Key': process.env.DATAGOUV_API_KEY,
      ...form.getHeaders()
    },
    body: form
  }

  await fetch(url, fetchOptions)
}

module.exports = {replaceResourceFile}
