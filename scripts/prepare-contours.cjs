#!/usr/bin/env node
require('dotenv').config()
const path = require('path')
const {mkdirp} = require('fs-extra')
const {prepareContours} = require('../lib/util/contours.cjs')

async function main() {
  await mkdirp(path.join(__dirname, '..', 'data'))
  await prepareContours()
  process.exit(0)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
