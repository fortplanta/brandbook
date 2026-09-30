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
  admin: { useAsTitle: 'filename', defaultColumns: ['filename', 'category', 'paletteColors', 'autoTagged', 'updatedAt'] },
  fields: [
    { name: 'alt', type: 'text', admin: { description: 'Alt text / caption for images.' } },
    // Filled by the drop zone's local image analysis (src/ingest/vision.js).
    {
      name: 'category', type: 'select', admin: { position: 'sidebar', description: 'Detected on ingest — editable.' },
      options: [
        { label: 'Key visual', value: 'keyvisual' }, { label: 'Rörligt (film)', value: 'motion' },
        { label: 'Logotyp', value: 'logo' }, { label: 'Färg i bruk', value: 'color' },
        { label: 'Digitalt', value: 'digital' }, { label: 'Print', value: 'print' },
        { label: 'Miljö', value: 'environment' }, { label: 'Profilprodukter', value: 'merch' },
        { label: 'Grafiska element', value: 'graphics' }, { label: 'Bildspråk (foto)', value: 'photo' },
      ],
    },
    { name: 'paletteColors', type: 'text', admin: { position: 'sidebar', description: 'Client palette colours found in the image.' } },
    { name: 'transparent', type: 'checkbox', admin: { position: 'sidebar', readOnly: true, description: 'Has a transparent background (measured on ingest) — lets the site generate mono/negative logo variants.' } },
    { name: 'autoTagged', type: 'checkbox', admin: { position: 'sidebar', readOnly: true, description: 'Categorised by the ingest analysis (not by hand).' } },
  ],
}
