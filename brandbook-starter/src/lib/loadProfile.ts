/* ============================================================================
   CONTENT SOURCE — one switch decides where a build gets its content:
     • PAYLOAD_URL set  → fetch this client from the CMS (REST, at build time)
     • PAYLOAD_URL unset → use the local file (src/content/profile.ts)
   Either way it returns the same typed `Profile`, so the rest of the site is
   identical and the CMS is a BUILD-TIME dependency only — if it's down, already
   built books keep serving.
   ========================================================================== */
import type { Profile } from '../content/profile';
import { profile as localProfile } from '../content/profile';
import { mapPayloadToProfile } from './payloadMap';

const BASE = import.meta.env.PAYLOAD_URL || process.env.PAYLOAD_URL || '';
const SLUG = import.meta.env.CLIENT_SLUG || process.env.CLIENT_SLUG || '';

export async function loadProfile(): Promise<Profile> {
  if (!BASE) return localProfile;

  const q = SLUG ? `?where[slug][equals]=${encodeURIComponent(SLUG)}&depth=2&limit=1` : '?depth=2&limit=1';
  const res = await fetch(`${BASE.replace(/\/$/, '')}/api/clients${q}`);
  if (!res.ok) throw new Error(`CMS fetch failed: ${res.status} ${res.statusText}`);

  const data = await res.json();
  const doc = data?.docs?.[0];
  if (!doc) throw new Error(`No published client found${SLUG ? ` for slug "${SLUG}"` : ''} at ${BASE}`);

  return mapPayloadToProfile(doc, BASE);
}
