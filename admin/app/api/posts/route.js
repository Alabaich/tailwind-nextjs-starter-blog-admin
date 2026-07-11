import { NextResponse } from 'next/server';
import { listPosts, savePost, slugify, postExists } from '../../../lib/posts';

export async function GET() {
  return NextResponse.json({ posts: listPosts() });
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  if (!body.title) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  }
  let slug = body.slug ? String(body.slug) : slugify(body.title);
  if (!slug) {
    return NextResponse.json(
      { error: 'Could not derive a slug from the title, set one manually' },
      { status: 400 }
    );
  }
  if (postExists(slug)) {
    return NextResponse.json({ error: `Post "${slug}" already exists` }, { status: 409 });
  }
  try {
    savePost({ ...body, slug });
    return NextResponse.json({ slug }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
