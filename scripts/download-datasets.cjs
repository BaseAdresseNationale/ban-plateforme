#!/usr/bin/env node
const path = require('path')
const {createWriteStream} = require('fs')
const {pipeline} = require('stream/promises')
const {mkdirp} = require('fs-extra')
const got = require('got')
const ora = require('ora')

const dataDir = path.join(__dirname, '..', 'data')

async function downloadFile(url, fileName) {
  const spinner = ora(`Téléchargement du fichier ${fileName}`).start()
  await pipeline(
    got.stream(url, {responseType: 'buffer'}),
    createWriteStream(path.join(dataDir, fileName))
  )
  spinner.succeed()
}

async function main() {
  await mkdirp(dataDir)

  await downloadFile(
    'https://www.data.gouv.fr/fr/datasets/r/8297d760-2c12-4811-af08-ad874c61e171',
    'communes-locaux-adresses.json'
  )

  await downloadFile(
    'https://adresse.data.gouv.fr/data/db/gazetteer/2023/gazetteer.sqlite',
    'gazetteer.sqlite'
  )

  await downloadFile(
    'https://adresse.data.gouv.fr/data/db/fantoir/2023/fantoir.sqlite',
    'fantoir.sqlite'
  )
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
