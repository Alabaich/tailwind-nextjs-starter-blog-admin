import { NextResponse } from 'next/server';
import { getPost, savePost, deletePost } from '../../../../lib/posts';

export async function GET(_req, { params }) {
  const { slug } = await params;
  try {
    const post = getPost(slug);
    if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ post });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function PUT(req, { params }) {
  const { slug } = await params;
  const body = await req.json().catch(() => ({}));
  try {
    savePost({ ...body, slug });
    return NextResponse.json({ slug });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function DELETE(_req, { params }) {
  const { slug } = await params;
  try {
    deletePost(slug);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
