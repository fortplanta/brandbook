/* ============================================================================
   PAYLOAD → PROFILE MAP — turns one Payload `clients` document (fetched at
   depth ≥ 2) into the exact `Profile` shape the components already consume.
   The only real work is: unwrap populated upload objects to absolute URLs, and
   normalise dates. Nothing downstream (components, styles) changes.
   ========================================================================== */
import type { Profile } from '../content/profile';

type Media = { url?: string | null } | null | undefined;

/** Absolute URL for an uploaded file. Payload returns "/api/media/file/x"; the
    build needs it prefixed with the CMS origin. */
const url = (m: Media, base: string): string | undefined => {
  if (!m || !m.url) return undefined;
  return /^https?:\/\//.test(m.url) ? m.url : base.replace(/\/$/, '') + m.url;
};

const day = (d?: string | null): string | undefined => (d ? String(d).slice(0, 10) : undefined);

const files = (arr: any[] | undefined, base: string) =>
  (arr ?? [])
    .map((f) => ({ label: f.label, href: url(f.file, base) ?? f.href ?? '#', size: f.size ?? undefined }))
    .filter((f) => f.href);

export function mapPayloadToProfile(doc: any, base: string): Profile {
  return {
    client: doc.name,
    tagline: doc.tagline ?? undefined,
    updated: day(doc.updated) ?? day(doc.updatedAt),
    accent: doc.accent ?? undefined,
    cover: { note: doc.coverNote ?? undefined },
    downloadAllHref: url(doc.downloadAll, base),

    platform: (doc.platform ?? []).map((b: any) => ({ title: b.title, body: b.body })),

    tone:
      doc.tone && (doc.tone.principles?.length ?? 0) > 0
        ? {
            intro: doc.tone.intro ?? undefined,
            principles: doc.tone.principles.map((p: any) => ({
              name: p.name, description: p.description, do: p.do ?? undefined, dont: p.dont ?? undefined,
            })),
            boilerplate: doc.tone.boilerplate ?? undefined,
          }
        : undefined,

    logos: (doc.logos ?? []).map((l: any) => ({
      name: l.name,
      note: l.note ?? undefined,
      onDark: Boolean(l.onDark),
      image: url(l.image, base) ?? '',
      files: files(l.files, base),
    })),

    colors: (doc.colors ?? []).map((c: any) => ({
      name: c.name, hex: c.hex, rgb: c.rgb ?? undefined, cmyk: c.cmyk ?? undefined,
      pantone: c.pantone ?? undefined, role: c.role ?? undefined,
    })),

    typography: (doc.typography ?? []).map((t: any) => ({
      name: t.name, role: t.role ?? undefined, stack: t.stack, weights: t.weights ?? undefined,
      note: t.note ?? undefined, specimen: t.specimen ?? undefined, files: files(t.files, base),
    })),

    imagery: {
      note: doc.imagery?.note ?? undefined,
      images: (doc.imagery?.images ?? [])
        .map((i: any) => ({ src: url(i.image, base) ?? '', caption: i.caption ?? undefined }))
        .filter((i: any) => i.src),
    },

    motion: (doc.motion ?? [])
      .map((m: any) => ({ title: m.title, note: m.note ?? undefined, src: url(m.src, base) ?? '', poster: url(m.poster, base) }))
      .filter((m: any) => m.src),

    downloads: (doc.downloads ?? []).map((g: any) => ({
      group: g.group,
      items: (g.items ?? [])
        .map((it: any) => ({ label: it.label, href: url(it.file, base) ?? it.href ?? '#', size: it.size ?? undefined }))
        .filter((it: any) => it.href && it.href !== '#'),
    })),

    changelog: (doc.changelog ?? []).map((c: any) => ({ date: day(c.date) ?? '', note: c.note })),
  };
}
