#!/usr/bin/env node
const {prepareContours} = require('../lib/util/contours')

async function main() {
  await prepareContours()
  process.exit(0)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
