#!/usr/bin/env node
const path = require('path')
const {mkdirp} = require('fs-extra')
const {prepareContours} = require('../lib/util/contours')

async function main() {
  await mkdirp(path.join(__dirname, '..', 'data'))
  await prepareContours()
  process.exit(0)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
