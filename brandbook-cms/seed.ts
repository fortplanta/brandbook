/* ============================================================================
   SEED — boots Payload's Local API (no HTTP server needed), creates an admin, a
   per-client editor, uploads the Tangent placeholder assets, and writes the
   Tangent client document. Run once: `pnpm seed`.
   ========================================================================== */
import path from 'path'
import { fileURLToPath } from 'url'
import nextEnv from '@next/env'
const { loadEnvConfig } = nextEnv
import { getPayload } from 'payload'
import config from './payload.config'

const dirname = path.dirname(fileURLToPath(import.meta.url))
loadEnvConfig(dirname)
// Reuse the placeholder assets that ship with the Astro starter.
const ASSETS = path.resolve(dirname, '../brandbook-starter/public/assets')

async function run() {
  const payload = await getPayload({ config })

  const upload = async (rel: string, alt: string) => {
    const doc = await payload.create({
      collection: 'media',
      data: { alt },
      filePath: path.resolve(ASSETS, rel),
    })
    return doc.id
  }

  // --- media ---
  const wordmark = await upload('logos/tangent-wordmark.svg', 'Tangent Technologies wordmark')
  const symbol = await upload('logos/tangent-symbol.svg', 'Tangent symbol')
  const img1 = await upload('imagery/mock-signage.svg', 'Building signage')
  const img2 = await upload('imagery/mock-product.svg', 'Product UI in context')
  const img3 = await upload('imagery/mock-app.svg', 'Application icon')
  const zip = await upload('tangent-brand-assets.zip', 'All brand assets')

  // --- the Tangent client document ---
  const tangent = await payload.create({
    collection: 'clients',
    data: {
      name: 'Tangent Technologies',
      slug: 'tangent',
      tagline: 'We partner with companies to optimize operational execution using our purpose-built agentic platform.',
      updated: '2026-09-18',
      accent: '#0B78DE',
      coverNote:
        'The whole Tangent brand in one place — logo, colours, type and files. Share the link internally; everyone works from the same source, always the latest version.',
      downloadAll: zip,
      platform: [
        { title: 'Idea', body: 'Companies now run on intelligence. Tangent makes that shift usable — a purpose-built agentic platform that turns operational complexity into executed work.' },
        { title: 'Positioning', body: 'We partner with companies to optimize operational execution using our purpose-built agentic platform.' },
        { title: 'Why teams choose Tangent', body: 'Not another dashboard. Agents that do the operational work, wired into how a company already runs — measurable in throughput, not promises.' },
      ],
      logos: [
        {
          name: 'Primary logo',
          note: 'Wordmark + symbol lockup. First choice. Keep clear space of at least the symbol height around it. (Placeholder — replace with the real export.)',
          onDark: false,
          image: wordmark,
          files: [{ label: 'SVG', file: wordmark, size: '3 KB' }],
        },
        {
          name: 'Symbol',
          note: 'The mark alone — for app icons, favicons and small surfaces. (Placeholder — replace with the real export.)',
          onDark: true,
          image: symbol,
          files: [{ label: 'SVG', file: symbol, size: '2 KB' }],
        },
      ],
      colors: [
        { name: 'Sky', hex: '#6BB4F8', rgb: '107 180 248', role: 'Light accent' },
        { name: 'Azure', hex: '#238FF4', rgb: '35 143 244', role: 'Accent' },
        { name: 'Signal', hex: '#0B78DE', rgb: '11 120 222', role: 'Primary' },
        { name: 'Deep', hex: '#06437C', rgb: '6 67 124', role: 'Dark blue' },
        { name: 'Navy', hex: '#042D54', rgb: '4 45 84', role: 'Deep' },
        { name: 'Ink', hex: '#010A13', rgb: '1 10 19', role: 'Bakgrund' },
        { name: 'Sand', hex: '#FADF93', rgb: '250 223 147', role: 'Warm accent' },
        { name: 'Mint', hex: '#A5D9CB', rgb: '165 217 203', role: 'Cool accent' },
        { name: 'Black', hex: '#000000', rgb: '0 0 0', role: 'Contrast' },
      ],
      typography: [
        {
          name: 'General Sans', role: 'Display', stack: '"General Sans", "Helvetica Neue", Arial, sans-serif', weights: 'Medium, Semibold, Bold',
          note: 'Headlines and lead statements. Set tight, slightly negative tracking at large sizes.',
          specimen: 'Companies now run on intelligence.',
        },
        {
          name: 'General Sans', role: 'Text', stack: '"General Sans", "Helvetica Neue", Arial, sans-serif', weights: 'Regular, Medium',
          note: 'Body copy and interface. One family across the system — neutral, robust, technical.',
          specimen: 'We partner with companies to optimize operational execution.',
        },
      ],
      imagery: {
        note: 'Architectural, dark, product-forward. Deep blues and glass, agentic UI in context. (Placeholders.)',
        images: [
          { image: img1, caption: 'Building signage' },
          { image: img2, caption: 'Product UI in context' },
          { image: img3, caption: 'Application icon' },
        ],
      },
      motion: [],
      downloads: [
        { group: 'Logos', items: [{ label: 'All logos (SVG)', file: zip, size: '3 KB' }] },
        { group: 'Typefaces', items: [{ label: 'General Sans (Fontshare)', href: 'https://www.fontshare.com/fonts/general-sans', size: '—' }] },
      ],
      changelog: [
        { date: '2026-09-18', note: 'Brand moved into the CMS — palette, General Sans and positioning copy.' },
        { date: '2026-09-17', note: 'Imported from Figma. Logo and imagery are placeholders pending real exports.' },
      ],
      _status: 'published',
    },
  })

  // --- users ---
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@fokusnordic.se'
  const adminPass = process.env.SEED_ADMIN_PASSWORD || 'changeme-please'
  await payload.create({
    collection: 'users',
    data: { email: adminEmail, password: adminPass, name: 'Agency Admin', role: 'admin' },
  })
  await payload.create({
    collection: 'users',
    data: {
      email: 'editor@fokusnordic.se',
      password: 'changeme-please',
      name: 'Tangent Editor',
      role: 'editor',
      clients: [tangent.id],
    },
  })

  payload.logger.info(`Seeded Tangent (${tangent.id}). Admin: ${adminEmail} / ${adminPass}`)
  process.exit(0)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
