import { config } from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, env } from 'prisma/config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
config({ path: path.resolve(process.cwd(), '.env') })
config({ path: path.resolve(__dirname, '../../.env') })

export default defineConfig({
  schema: './prisma/schema.prisma',
  migrations: {
    path: './prisma/migrations',
  },
  datasource: {
    url: env('PG_URL'),
  },
})
