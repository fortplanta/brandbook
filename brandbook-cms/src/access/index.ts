/* ============================================================================
   ACCESS CONTROL — this is the whole point of choosing a CMS with roles.
   Two roles: 'admin' (agency leads) sees and edits everything; 'editor'
   (designers, PMs) sees and edits ONLY the clients assigned to them.
   Public/anonymous reads (the Astro build fetching content) get PUBLISHED
   docs only, so drafts never leak into a live book.
   Access rules are plain functions — per-client scoping costs nothing and is
   not gated behind a paid tier.
   ========================================================================== */
import type { Access, FieldAccess } from 'payload'

const assignedClientIds = (user: any): string[] =>
  (user?.clients ?? []).map((c: any) => (typeof c === 'object' ? c.id : c))

export const isAdmin: Access = ({ req: { user } }) => user?.role === 'admin'

/** field-level: only admins can change a user's role or client assignments */
export const isAdminField: FieldAccess = ({ req: { user } }) => user?.role === 'admin'

/** Users: admins manage everyone; an editor can read/update only their own record */
export const adminOrSelf: Access = ({ req: { user } }) => {
  if (!user) return false
  if (user.role === 'admin') return true
  return { id: { equals: user.id } }
}

/** Clients read: admin → all; editor → published + their own drafts; public → published only */
export const clientRead: Access = ({ req: { user } }) => {
  if (user?.role === 'admin') return true
  if (user?.role === 'editor') {
    return {
      or: [
        { _status: { equals: 'published' } },
        { id: { in: assignedClientIds(user) } },
      ],
    }
  }
  return { _status: { equals: 'published' } }
}

/** Clients write: admin → all; editor → only assigned clients; else → none */
export const clientWrite: Access = ({ req: { user } }) => {
  if (user?.role === 'admin') return true
  if (user?.role === 'editor') return { id: { in: assignedClientIds(user) } }
  return false
}

/** Media: readable by anyone (the built sites are public); writable by any signed-in editor */
export const authenticated: Access = ({ req: { user } }) => Boolean(user)
export const anyoneRead: Access = () => true
