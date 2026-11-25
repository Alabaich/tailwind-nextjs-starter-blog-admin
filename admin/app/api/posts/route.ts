import { NextResponse } from 'next/server';
import { errorResponse, MAX_POST_BYTES } from '@/lib/api';
import { jsonError, readJsonObject } from '@/lib/http';
import { listPosts, parsePostInput, postExists, savePost } from '@/lib/posts';
import { isValidSlug, slugify } from '@/lib/slug';

export const dynamic = 'force-dynamic';

export function GET() {
  try {
    return NextResponse.json({ posts: listPosts() });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    const body = await readJsonObject(req, MAX_POST_BYTES);
    const input = parsePostInput(body);
    const requested = typeof body.slug === 'string' ? body.slug.trim() : '';
    const slug = requested || slugify(input.title);
    if (!slug) {
      return jsonError('Could not derive a slug from the title, set one manually', 400);
    }
    if (!isValidSlug(slug)) {
      return jsonError('Slug may only contain lowercase letters, digits and hyphens', 400);
    }
    if (postExists(slug)) return jsonError(`Post "${slug}" already exists`, 409);
    savePost(slug, input);
    return NextResponse.json({ slug }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
