import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Editor from '@/components/Editor';
import { getPost, ValidationError } from '@/lib/posts';
import type { Post } from '@/lib/posts';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ slug: string }>;
}

function load(slug: string): Post | null {
  try {
    return getPost(slug);
  } catch (err) {
    // A malformed slug in the URL is a 404, not a server error.
    if (err instanceof ValidationError) return null;
    throw err;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = load((await params).slug);
  return { title: post?.title || 'Edit post' };
}

export default async function EditPostPage({ params }: Props) {
  const post = load((await params).slug);
  if (!post) notFound();
  // Keyed by slug so navigating between posts never reuses editor state.
  return <Editor key={post.slug} initial={post} />;
}
