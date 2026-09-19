import type { CollectionConfig } from 'payload'
import path from 'path'
import { fileURLToPath } from 'url'
import { anyoneRead, authenticated, isAdmin } from '../access'

const dirname = path.dirname(fileURLToPath(import.meta.url))

/* One upload collection for every brand asset: logo SVGs, PNGs, fonts, the
   download-all ZIP, motion MP4s, imagery. Files land on the server's disk
   (../media) — swap `staticDir` for an S3/R2 adapter later without touching
   anything else. Readable by anyone because the built books are public. */
export const Media: CollectionConfig = {
  slug: 'media',
  upload: {
    staticDir: path.resolve(dirname, '../../media'),
    mimeTypes: [
      'image/*',
      'video/*',
      'font/*',
      'application/font-woff',
      'application/vnd.ms-opentype',
      'application/zip',
      'application/octet-stream',
    ],
  },
  access: { read: anyoneRead, create: authenticated, update: authenticated, delete: isAdmin },
  admin: { useAsTitle: 'filename' },
  fields: [
    { name: 'alt', type: 'text', admin: { description: 'Alt text / caption for images.' } },
  ],
}
