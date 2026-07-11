import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import { gitCommit } from '../../../lib/posts';

const UPLOAD_DIR = process.env.UPLOAD_DIR || '/uploads';
const ALLOWED = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.avif']);

export async function POST(req) {
  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!file || typeof file.arrayBuffer !== 'function') {
    return NextResponse.json({ error: 'No file' }, { status: 400 });
  }
  const ext = path.extname(file.name || '').toLowerCase();
  if (!ALLOWED.has(ext)) {
    return NextResponse.json({ error: `File type ${ext || '?'} not allowed` }, { status: 400 });
  }
  const base = path
    .basename(file.name, ext)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'image';
  const name = `${base}-${Date.now().toString(36)}${ext}`;
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  fs.writeFileSync(path.join(UPLOAD_DIR, name), Buffer.from(await file.arrayBuffer()));
  gitCommit(`upload: ${name}`);
  return NextResponse.json({ path: `/static/images/uploads/${name}` }, { status: 201 });
}
