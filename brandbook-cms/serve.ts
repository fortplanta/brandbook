/* Minimal REST shim over the seeded Payload DB — reproduces the exact envelope
   Payload's own /api/clients and /api/media/file/* return, so the Astro loader
   is tested against real CMS data without booting the Next admin. */
import http from 'http'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { getPayload } from 'payload'
import config from './payload.config'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const MEDIA = path.resolve(dirname, 'media')
const payload = await getPayload({ config })

http.createServer(async (req, res) => {
  const u = new URL(req.url || '/', 'http://localhost')
  res.setHeader('Access-Control-Allow-Origin', '*')
  try {
    if (u.pathname === '/api/clients') {
      const slug = u.searchParams.get('where[slug][equals]')
      const depth = Number(u.searchParams.get('depth') || '2')
      const limit = Number(u.searchParams.get('limit') || '10')
      const result = await payload.find({
        collection: 'clients',
        where: slug ? { slug: { equals: slug } } : undefined,
        depth, limit,
        overrideAccess: false, // public read → published only, exactly like the real API
      })
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(result))
      return
    }
    if (u.pathname.startsWith('/api/media/file/')) {
      const name = decodeURIComponent(u.pathname.replace('/api/media/file/', ''))
      const fp = path.join(MEDIA, name)
      if (!fp.startsWith(MEDIA) || !fs.existsSync(fp)) { res.statusCode = 404; res.end('not found'); return }
      const ext = path.extname(fp).toLowerCase()
      const types: Record<string,string> = { '.svg':'image/svg+xml', '.png':'image/png', '.zip':'application/zip', '.mp4':'video/mp4' }
      res.setHeader('Content-Type', types[ext] || 'application/octet-stream')
      fs.createReadStream(fp).pipe(res)
      return
    }
    res.statusCode = 404; res.end('not found')
  } catch (e: any) { res.statusCode = 500; res.end(String(e?.message || e)) }
}).listen(3300, () => payload.logger.info('REST shim on http://localhost:3300'))
