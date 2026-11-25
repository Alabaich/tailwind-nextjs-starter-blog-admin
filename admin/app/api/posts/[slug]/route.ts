import { NextResponse } from 'next/server';
import { errorResponse, MAX_POST_BYTES } from '@/lib/api';
import { jsonError, readJsonObject } from '@/lib/http';
import { deletePost, getPost, parsePostInput, postExists, savePost } from '@/lib/posts';

export const dynamic = 'force-dynamic';

interface Context {
  params: Promise<{ slug: string }>;
}

export async function GET(_req: Request, { params }: Context) {
  try {
    const post = getPost((await params).slug);
    return post ? NextResponse.json({ post }) : jsonError('Not found', 404);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PUT(req: Request, { params }: Context) {
  try {
    const { slug } = await params;
    // PUT updates; it must not silently create posts under arbitrary slugs.
    if (!postExists(slug)) return jsonError('Not found', 404);
    savePost(slug, parsePostInput(await readJsonObject(req, MAX_POST_BYTES)));
    return NextResponse.json({ slug });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(_req: Request, { params }: Context) {
  try {
    return deletePost((await params).slug)
      ? NextResponse.json({ ok: true })
      : jsonError('Not found', 404);
  } catch (err) {
    return errorResponse(err);
  }
}
