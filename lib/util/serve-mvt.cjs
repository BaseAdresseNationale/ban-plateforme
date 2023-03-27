const {promisify} = require('util')
const zlib = require('zlib')
const {mapValues, pickBy} = require('lodash')
const geojsonVt = require('geojson-vt')
const vtpbf = require('vt-pbf')
const {featureCollection} = require('@turf/turf')

const gzip = promisify(zlib.gzip)

async function serveMvt(req, res) {
  const {layersFeatures, z, x, y} = req
  const layersTiles = mapValues(layersFeatures, features => {
    if (!features || features.length === 0) {
      return
    }

    const tileIndex = geojsonVt(featureCollection(features), {maxZoom: z, indexMaxZoom: z})
    return tileIndex.getTile(z, x, y)
  })

  // We use pickBy to remove empty layers
  const pbf = vtpbf.fromGeojsonVt(pickBy(layersTiles))

  res.set({
    'Content-Type': 'application/x-protobuf',
    'Content-Encoding': 'gzip'
  })

  res.send(await gzip(Buffer.from(pbf)))
}

module.exports = serveMvt
