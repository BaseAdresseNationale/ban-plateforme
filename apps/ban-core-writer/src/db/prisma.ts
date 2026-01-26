import { PrismaClient } from '@prisma'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'

const connectionString = process.env.PG_URL

if (!connectionString) {
  throw new Error('PG_URL is not defined')
}

const pool = new Pool({ connectionString})
const adapter = new PrismaPg(pool)

export type { Prisma, PrismaClient } from '@prisma'
export const prisma: PrismaClient = new PrismaClient({ adapter })
export default prisma
