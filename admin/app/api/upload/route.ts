import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { errorResponse } from '@/lib/api';
import { gitCommit } from '@/lib/history';
import { jsonError } from '@/lib/http';
import { maxUploadBytes, sniffImageType, uploadName } from '@/lib/uploads';

const uploadDir = (): string => process.env.UPLOAD_DIR || '/uploads';

export async function POST(req: Request) {
  try {
    const limit = maxUploadBytes();
    const tooLarge = () =>
      jsonError(`Image is too large (max ${Math.round(limit / 1024 / 1024)} MB)`, 413);

    // Cheap rejection before buffering anything. Caddy enforces a hard cap on
    // the request body as well, for clients that lie about Content-Length.
    if (Number(req.headers.get('content-length') ?? 0) > limit + 64 * 1024) return tooLarge();

    const form = await req.formData().catch(() => null);
    const file = form?.get('file');
    if (!(file instanceof File)) return jsonError('No file', 400);
    if (file.size > limit) return tooLarge();

    const bytes = new Uint8Array(await file.arrayBuffer());
    const type = sniffImageType(bytes);
    if (!type) {
      return jsonError('Unsupported image. Use PNG, JPEG, GIF, WebP or AVIF.', 415);
    }

    const name = uploadName(file.name, type, randomBytes(4).toString('hex'));
    fs.mkdirSync(uploadDir(), { recursive: true });
    // 'wx': never overwrite an existing upload.
    fs.writeFileSync(path.join(uploadDir(), name), bytes, { flag: 'wx' });
    gitCommit(`upload: ${name}`);
    return NextResponse.json({ path: `/static/images/uploads/${name}` }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
