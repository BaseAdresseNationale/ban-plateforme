const {createReadStream} = require('fs')
const {pathExists} = require('fs-extra')
const got = require('got')

async function getAsStream(path) {
  if (path.startsWith('http')) {
    return new Promise(resolve => {
      const stream = got.stream(path)
      stream.on('response', response => {
        if (response.statusCode === 200) {
          return resolve(stream)
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
