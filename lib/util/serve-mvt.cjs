const {promisify} = require('util')
const zlib = require('zlib')
const {mapValues, pickBy} = require('lodash')
const geojsonVt = require('geojson-vt')
const vtpbf = require('vt-pbf')
const {featureCollection} = require('@turf/turf')
const {redis} = require('./redis.cjs')

const gzip = promisify(zlib.gzip)

const {REDIS_MAPTILES_CACHE_DURATION: MAPTILES_CACHE_DURATION} = process.env

const generatePBFTileCompressed = async (layersFeatures, z, x, y) => {
  const layersTiles = mapValues(layersFeatures, features => {
    if (!features || features.length === 0) {
      return
    }

    const tileIndex = geojsonVt(featureCollection(features), {maxZoom: z, indexMaxZoom: z})
    return tileIndex.getTile(z, x, y)
  })

  // We use pickBy to remove empty layers
  const pbf = vtpbf.fromGeojsonVt(pickBy(layersTiles))
  const pbfCompressed = await gzip(Buffer.from(pbf))
  return pbfCompressed
}

const getPBFTileCompressedFromCache = async cacheKey => {
  if (!MAPTILES_CACHE_DURATION) {
    return null
  }

  // Check if tile buffer is already in cache
  const cachedTile = await redis.getBuffer(cacheKey)
  if (cachedTile) {
    return cachedTile
  }

  return null
}

const storePBFTileCompressedInCache = async (cacheKey, pbfTileCompressed) => {
  if (!MAPTILES_CACHE_DURATION) {
    return
  }

  // Store in cache
  await redis.set(cacheKey, pbfTileCompressed, 'EX', MAPTILES_CACHE_DURATION)
}

const getPBFTileCompressed = async (layersFeatures, z, x, y) => {
  // Generate cache key for redis
  const cacheKey = `${z}:${x}:${y}`

  // Check if tile buffer is already in cache
  const cachedPBFTileCompressed = await getPBFTileCompressedFromCache(cacheKey)

  if (cachedPBFTileCompressed) {
    return cachedPBFTileCompressed
  }

  // Generate tile buffer if not in cache
  const pbfTileCompressed = await generatePBFTileCompressed(layersFeatures, z, x, y)

  // Store in cache
  await storePBFTileCompressedInCache(cacheKey, pbfTileCompressed)

  return pbfTileCompressed
}

async function serveMvt(req, res) {
  const {layersFeatures, z, x, y} = req
  const pbfTileCompressed = await getPBFTileCompressed(layersFeatures, z, x, y)

  res.set({
    'Content-Type': 'application/x-protobuf',
    'Content-Encoding': 'gzip'
  })

  res.send(pbfTileCompressed)
}

module.exports = serveMvt
