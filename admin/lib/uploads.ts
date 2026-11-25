// Upload validation. Pure functions, no filesystem access.

export type ImageType = 'png' | 'jpg' | 'gif' | 'webp' | 'avif';

export const CONTENT_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  svg: 'image/svg+xml',
};

/** Names the admin will serve back for previews. No path separators. */
export const UPLOAD_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*\.(png|jpe?g|gif|webp|avif|svg)$/i;

export function maxUploadBytes(): number {
  const mb = Number(process.env.MAX_UPLOAD_MB);
  return (Number.isFinite(mb) && mb > 0 ? mb : 8) * 1024 * 1024;
}

function ascii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.subarray(start, end));
}

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  return signature.every((b, i) => bytes[i] === b);
}

/**
 * Identifies an image by its magic bytes. The file extension and the
 * client-supplied MIME type are both attacker-controlled, so neither is
 * trusted. SVG is deliberately not accepted: it is a script-capable document
 * that would be served from the blog's origin.
 */
export function sniffImageType(bytes: Uint8Array): ImageType | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'jpg';
  const head = ascii(bytes, 0, 6);
  if (head === 'GIF87a' || head === 'GIF89a') return 'gif';
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP') return 'webp';
  if (ascii(bytes, 4, 8) === 'ftyp' && ['avif', 'avis'].includes(ascii(bytes, 8, 12))) {
    return 'avif';
  }
  return null;
}

/** `My Photo (1).PNG` -> `my-photo-1-<suffix>.png`; extension comes from content. */
export function uploadName(original: string, type: ImageType, suffix: string): string {
  const base =
    original
      .replace(/\.[^./\\]*$/, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64)
      .replace(/-+$/, '') || 'image';
  return `${base}-${suffix}.${type}`;
}
