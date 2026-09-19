import type { CollectionConfig } from 'payload'
import { isAdmin, isAdminField, adminOrSelf } from '../access'

/* Trusted agency editors. `role` + `clients` are what scope a person to the
   brandbooks they're allowed to touch. Clients are viewers — they never get a
   login here. */
export const Users: CollectionConfig = {
  slug: 'users',
  auth: true,
  admin: { useAsTitle: 'email', defaultColumns: ['email', 'name', 'role', 'clients'] },
  access: {
    read: adminOrSelf,
    create: isAdmin,
    update: adminOrSelf,
    delete: isAdmin,
  },
  fields: [
    { name: 'name', type: 'text' },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'editor',
      options: [
        { label: 'Admin (agency lead — all clients)', value: 'admin' },
        { label: 'Editor (assigned clients only)', value: 'editor' },
      ],
      access: { update: isAdminField },
      admin: { description: 'Admins see every client. Editors see only the clients listed below.' },
    },
    {
      name: 'clients',
      type: 'relationship',
      relationTo: 'clients',
      hasMany: true,
      access: { update: isAdminField },
      admin: {
        description: 'Which client brandbooks this editor may edit. Ignored for admins.',
        condition: (data) => data?.role !== 'admin',
      },
    },
  ],
}
