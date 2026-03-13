import { getPrismaClient } from '@ban/api';

const prismaPg = getPrismaClient();

export async function testBddConnection() {
  console.log('🔌 Testing Prisma connection...')

  const now = await prismaPg.$queryRaw`SELECT NOW() as now`
  console.log('🕒 DB time:', now)

  console.log('ℹ️ Prisma seems to be working!')
}

export async function bddDisconnect() {
  await prismaPg.$disconnect()
}

export async function testBdd() {
  return testBddConnection()
    .catch((e) => {
      console.error('❌ Error during Prisma test:', e)
    })
    .finally(async () => {
      await bddDisconnect()
    })
}
