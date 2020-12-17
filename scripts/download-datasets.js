#!/usr/bin/env node
const path = require('path')
const got = require('got')
const {outputFile} = require('fs-extra')

const dataDir = path.join(__dirname, '..', 'data')

async function downloadFile(url, fileName) {
  const response = await got(url, {responseType: 'buffer'})
  await outputFile(path.join(dataDir, fileName), response.body)
  console.log(` * ${fileName} téléchargé`)
}

async function main() {
  await downloadFile(
    'https://www.data.gouv.fr/fr/datasets/r/9a4a5188-8142-4c9d-b3e6-f54594848509',
    'communes-locaux-adresses.json'
  )
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
