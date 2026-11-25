// Serves uploaded images to the (authenticated) admin so the editor preview
// can show them before a deploy bakes them into the live site. The URL is the
// same path the blog serves them from, so markdown works unchanged in both.
import fs from 'node:fs';
import path from 'node:path';
import { CONTENT_TYPES, UPLOAD_NAME_RE } from '@/lib/uploads';

export const dynamic = 'force-dynamic';

const uploadDir = (): string => process.env.UPLOAD_DIR || '/uploads';

export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  // The pattern has no path separators, so the name cannot leave the directory.
  if (!UPLOAD_NAME_RE.test(name) || name !== path.basename(name)) {
    return new Response('Not found', { status: 404 });
  }
  let bytes: Buffer;
  try {
    bytes = fs.readFileSync(path.join(uploadDir(), name));
  } catch {
    return new Response('Not found', { status: 404 });
  }
  const ext = path.extname(name).slice(1).toLowerCase();
  return new Response(new Uint8Array(bytes), {
    headers: {
      'content-type': CONTENT_TYPES[ext] ?? 'application/octet-stream',
      'x-content-type-options': 'nosniff',
      // Legacy SVG uploads are script-capable documents: sandbox them so
      // opening one directly cannot run code in the admin's origin.
      'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      'cache-control': 'private, max-age=3600',
    },
  });
}
