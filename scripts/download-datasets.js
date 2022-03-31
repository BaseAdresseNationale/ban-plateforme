#!/usr/bin/env node
const path = require('path')
const {createWriteStream} = require('fs')
const {pipeline} = require('stream/promises')
const {mkdirp} = require('fs-extra')
const got = require('got')

const dataDir = path.join(__dirname, '..', 'data')

async function downloadFile(url, fileName) {
  await pipeline(
    got.stream(url, {responseType: 'buffer'}),
    createWriteStream(path.join(dataDir, fileName))
  )
  console.log(` * ${fileName} téléchargé`)
}

async function main() {
  await mkdirp(dataDir)

  await downloadFile(
    'https://www.data.gouv.fr/fr/datasets/r/9a4a5188-8142-4c9d-b3e6-f54594848509',
    'communes-locaux-adresses.json'
  )

  await downloadFile(
    'https://adresse.data.gouv.fr/data/db/gazetteer/2022/gazetteer.sqlite',
    'gazetteer.sqlite'
  )

  await downloadFile(
    'https://adresse.data.gouv.fr/data/db/fantoir/2022/fantoir.sqlite',
    'fantoir.sqlite'
  )
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
