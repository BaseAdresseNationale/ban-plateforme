import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'

 // TODO : Prefere the future internal librairy "@ban/prisma-client" :
import { PrismaClient } from '../../../../generated/client/client.js'
import { withRangeValidity } from '../../../../prisma/extensions/rangeValidity.js'

const connectionString = process.env.PG_URL

if (!connectionString) {
  throw new Error('PG_URL is not defined')
}

export const pool = new Pool({ connectionString})

const adapter = new PrismaPg(pool)
export const getPrismaClient = () => {
  const prismaBase = new PrismaClient({ adapter })
  // return prismaBase
  const prismaWithRangeValidity = withRangeValidity(prismaBase)
  return prismaWithRangeValidity
}

export default getPrismaClient
