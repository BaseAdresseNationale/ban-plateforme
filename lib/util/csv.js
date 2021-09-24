const {createGunzip} = require('gunzip-stream')
const pumpify = require('pumpify')
const Papa = require('papaparse')
const getStream = require('get-stream')
const intoStream = require('into-stream')

async function readCsv(buffer, parseParams) {
  return getStream.array(pumpify.obj(
    intoStream(buffer),
    createGunzip(),
    Papa.parse(Papa.NODE_STREAM_INPUT, {header: true, ...parseParams})
  ))
}

module.exports = {readCsv}
