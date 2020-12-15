const {promisify} = require('util')
const zlib = require('zlib')
const {mapValues} = require('lodash')
const geojsonVt = require('geojson-vt')
const vtpbf = require('vt-pbf')
const {featureCollection} = require('@turf/turf')

const gzip = promisify(zlib.gzip)

async function serveMvt(req, res) {
  const {layersFeatures, z, x, y} = req
  const layersTiles = mapValues(layersFeatures, features => {
    const tileIndex = geojsonVt(featureCollection(features), {maxZoom: z, indexMaxZoom: z})
    return tileIndex.getTile(z, x, y)
  })

  const pbf = vtpbf.fromGeojsonVt(layersTiles)

  res.set({
    'Content-Type': 'application/x-protobuf',
    'Content-Encoding': 'gzip'
  })

  res.send(await gzip(Buffer.from(pbf)))
}

module.exports = serveMvt
