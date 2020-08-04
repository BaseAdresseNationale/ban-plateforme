const {PassThrough} = require('stream')
const {createReadStream} = require('fs')
const {pathExists} = require('fs-extra')
const got = require('got')

async function getAsStream(path) {
  if (path.startsWith('http')) {
    return new Promise(resolve => {
      const proxyStream = new PassThrough()
      const gotStream = got.stream(path)
      gotStream.pipe(proxyStream)

      gotStream.on('response', response => {
        if (response.statusCode === 200) {
          return resolve(proxyStream)
        }

        resolve(null)
      })
    })
  }

  if (!(await pathExists(path))) {
    return null
  }

  return createReadStream(path)
}

module.exports = getAsStream
