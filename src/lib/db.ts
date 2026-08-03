import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  // Bumped whenever the Prisma schema gains a model so the cached
  // singleton from a previous dev-server boot is invalidated.
  prismaSchemaVersion?: number
}

// Bump this number after `prisma db push` introduces new models.
// It invalidates the cached PrismaClient in dev mode so the freshly
// generated client (with the new model delegate) is used instead.
const SCHEMA_VERSION = 2

/**
 * In Next.js dev mode the `node_modules/.prisma/client` modules are
 * cached in `require.cache` after the first boot. When `prisma db push`
 * regenerates the client with a new model, the running dev server keeps
 * using the stale module. This helper clears those cache entries so the
 * next `new PrismaClient()` picks up the freshly generated delegates.
 */
function bustPrismaRequireCache(): void {
  try {
    const cache = (require as any).cache
    if (!cache) return
    for (const key of Object.keys(cache)) {
      if (key.includes('/.prisma/client') || key.includes('/@prisma/client')) {
        delete cache[key]
      }
    }
  } catch {
    /* ignore */
  }
}

function createClient(): PrismaClient {
  if (process.env.NODE_ENV !== 'production') bustPrismaRequireCache()
  // Re-resolve PrismaClient after busting the require cache so we get
  // the freshly generated class with the new model delegates.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const prismaModule = require('@prisma/client') as {
    PrismaClient: typeof PrismaClient
  }
  return new prismaModule.PrismaClient({ log: ['query'] })
}

const cachedVersion = globalForPrisma.prismaSchemaVersion
const cachedClient = globalForPrisma.prisma
const isStale =
  cachedVersion !== SCHEMA_VERSION ||
  !cachedClient ||
  typeof (cachedClient as any).notification === 'undefined'

export const db = isStale ? createClient() : (cachedClient as PrismaClient)

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db
  globalForPrisma.prismaSchemaVersion = SCHEMA_VERSION
}