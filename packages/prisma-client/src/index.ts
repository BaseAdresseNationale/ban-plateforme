import { PrismaClient } from '../generated/client/client.js'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

import { withRangeValidity } from '../prisma/extensions/rangeValidity.js'

export { PrismaClient }
export { Prisma } from '../generated/client/client.js'
export { exportNdjson } from '../prisma/extensions/exportNdjson.progress.batch.js'

const connectionString = process.env.PG_URL

if (!connectionString) {
  throw new Error('PG_URL is not defined')
}

export const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)

export const getPrismaClient = () => {
  const prismaBase = new PrismaClient({ adapter })
  return withRangeValidity(prismaBase)
}

export default getPrismaClient
