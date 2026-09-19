import type { CollectionConfig } from 'payload'
import { clientRead, clientWrite, isAdmin } from '../access'

/* ============================================================================
   CLIENTS — one document = one client's brandbook. The fields mirror the
   `Profile` interface in the Astro starter (src/content/profile.ts) one-to-one,
   so the typed contract you already have IS the schema. Uploads (image / file)
   point at the Media collection; the Astro loader reads their `.url`.
   Drafts + versions are on, which gives non-technical editors a Save-draft /
   Publish flow and a visible version history (this replaces Git as the
   "living document" backbone).
   ========================================================================== */
export const Clients: CollectionConfig = {
  slug: 'clients',
  versions: { drafts: true, maxPerDoc: 50 },
  access: { read: clientRead, create: isAdmin, update: clientWrite, delete: isAdmin },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'updated', '_status'],
    description: 'Each document is one client brandbook. Save a draft, then Publish.',
  },
  fields: [
    // Smart ingest: drop/paste content → the engine fills the fields below.
    { name: 'ingest', type: 'ui', admin: { components: { Field: '/admin/IngestPanel#IngestPanel' } } },
    {
      type: 'row',
      fields: [
        { name: 'name', type: 'text', required: true, admin: { width: '60%', description: 'Brand name (shown as the title).' } },
        { name: 'slug', type: 'text', required: true, unique: true, index: true, admin: { width: '40%', description: 'URL key the site build fetches by, e.g. "tangent".' } },
      ],
    },
    { name: 'tagline', type: 'textarea' },
    {
      type: 'row',
      fields: [
        { name: 'updated', type: 'date', admin: { width: '50%', description: 'Shown as "Updated …". Leave blank to use the last save date.' } },
        { name: 'accent', type: 'text', admin: { width: '50%', description: 'Brand accent, hex (e.g. #0B78DE). Used only inside content, never on the chrome.' } },
      ],
    },
    { name: 'coverNote', type: 'textarea', admin: { description: 'Intro paragraph on the cover.' } },
    { name: 'downloadAll', type: 'upload', relationTo: 'media', admin: { description: 'The single "download everything" ZIP.' } },

    {
      type: 'tabs',
      tabs: [
        {
          label: 'Kärnan · Röst',
          fields: [
            {
              name: 'platform', type: 'array', label: 'Platform blocks (Kärnan)',
              fields: [
                { name: 'title', type: 'text', required: true },
                { name: 'body', type: 'textarea', required: true },
              ],
            },
            {
              name: 'tone', type: 'group', label: 'Tone of voice (Röst)',
              admin: { description: 'Optional. Leave the principles empty and the Röst category disappears.' },
              fields: [
                { name: 'intro', type: 'textarea' },
                {
                  name: 'principles', type: 'array',
                  fields: [
                    { name: 'name', type: 'text', required: true },
                    { name: 'description', type: 'textarea', required: true },
                    { name: 'do', type: 'text', label: 'Do (example)' },
                    { name: 'dont', type: 'text', label: "Don't (example)" },
                  ],
                },
                { name: 'boilerplate', type: 'textarea' },
              ],
            },
          ],
        },
        {
          label: 'Uttryck',
          fields: [
            {
              name: 'logos', type: 'array',
              fields: [
                { name: 'name', type: 'text', required: true },
                { name: 'note', type: 'textarea' },
                { name: 'onDark', type: 'checkbox', label: 'Show on a dark stage', defaultValue: false },
                { name: 'image', type: 'upload', relationTo: 'media', required: true },
                {
                  name: 'files', type: 'array', label: 'Download files',
                  fields: [
                    { name: 'label', type: 'text', required: true },
                    { name: 'file', type: 'upload', relationTo: 'media', required: true },
                    { name: 'size', type: 'text' },
                  ],
                },
              ],
            },
            {
              name: 'colors', type: 'array',
              fields: [
                {
                  type: 'row',
                  fields: [
                    { name: 'name', type: 'text', required: true, admin: { width: '50%' } },
                    { name: 'hex', type: 'text', required: true, admin: { width: '25%' } },
                    { name: 'role', type: 'text', admin: { width: '25%' } },
                  ],
                },
                {
                  type: 'row',
                  fields: [
                    { name: 'rgb', type: 'text', admin: { width: '34%' } },
                    { name: 'cmyk', type: 'text', admin: { width: '33%' } },
                    { name: 'pantone', type: 'text', admin: { width: '33%' } },
                  ],
                },
              ],
            },
            {
              name: 'typography', type: 'array',
              fields: [
                {
                  type: 'row',
                  fields: [
                    { name: 'name', type: 'text', required: true, admin: { width: '50%' } },
                    { name: 'role', type: 'text', admin: { width: '50%' } },
                  ],
                },
                { name: 'stack', type: 'text', required: true, admin: { description: 'CSS font-family stack.' } },
                { name: 'weights', type: 'text' },
                { name: 'specimen', type: 'text' },
                { name: 'note', type: 'textarea' },
                {
                  name: 'files', type: 'array', label: 'Font files',
                  fields: [
                    { name: 'label', type: 'text', required: true },
                    { name: 'file', type: 'upload', relationTo: 'media', required: true },
                    { name: 'size', type: 'text' },
                  ],
                },
              ],
            },
            {
              name: 'imagery', type: 'group',
              fields: [
                { name: 'note', type: 'textarea' },
                {
                  name: 'images', type: 'array',
                  fields: [
                    { name: 'image', type: 'upload', relationTo: 'media', required: true },
                    { name: 'caption', type: 'text' },
                  ],
                },
              ],
            },
            {
              name: 'motion', type: 'array',
              admin: { description: 'Video. Leave empty and the Rörligt section disappears.' },
              fields: [
                { name: 'title', type: 'text', required: true },
                { name: 'note', type: 'text' },
                { name: 'src', type: 'upload', relationTo: 'media', required: true },
                { name: 'poster', type: 'upload', relationTo: 'media' },
              ],
            },
          ],
        },
        {
          label: 'Material · Historik',
          fields: [
            {
              name: 'downloads', type: 'array', label: 'Download groups (Material)',
              fields: [
                { name: 'group', type: 'text', required: true },
                {
                  name: 'items', type: 'array',
                  fields: [
                    { name: 'label', type: 'text', required: true },
                    { name: 'file', type: 'upload', relationTo: 'media' },
                    { name: 'href', type: 'text', admin: { description: 'External link, if not an uploaded file.' } },
                    { name: 'size', type: 'text' },
                  ],
                },
              ],
            },
            {
              name: 'changelog', type: 'array', label: 'Change history',
              fields: [
                { name: 'date', type: 'date', required: true },
                { name: 'note', type: 'text', required: true },
              ],
            },
          ],
        },
      ],
    },
  ],
}
