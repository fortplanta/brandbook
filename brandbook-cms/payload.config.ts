import path from 'path'
import { fileURLToPath } from 'url'
import { buildConfig } from 'payload'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import sharp from 'sharp'

import { Users } from './src/collections/Users'
import { Clients } from './src/collections/Clients'
import { Media } from './src/collections/Media'

const dirname = path.dirname(fileURLToPath(import.meta.url))

/* Self-hosted, single box. SQLite by default — one file (brandbook.db), trivial
   to back up, no DB server to run. For heavier use swap `sqliteAdapter` for
   `postgresAdapter` (one line); nothing else changes. */
export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: { baseDir: path.resolve(dirname, 'src') },
  },
  collections: [Clients, Media, Users],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || 'dev-secret-change-me',
  typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },
  db: sqliteAdapter({
    client: { url: process.env.DATABASE_URI || `file:${path.resolve(dirname, 'brandbook.db')}` },
    push: true, // dev: auto-sync schema. For production, generate + run migrations instead.
  }),
  sharp,
  // The Astro build reads these over REST; allow it to fetch during build.
  cors: (process.env.CORS_ORIGINS || '').split(',').filter(Boolean),
})
