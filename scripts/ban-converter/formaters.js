import normalize from '@etalab/normadresse'

const formaters = {
  NUMBER: Number,
  NORMALIZE: normalize,
  ARRAY_JOIN: arr => arr.join('|'),
}

export default formaters
