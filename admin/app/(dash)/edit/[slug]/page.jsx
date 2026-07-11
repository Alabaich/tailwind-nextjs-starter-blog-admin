import Link from 'next/link';
import { notFound } from 'next/navigation';
import Editor from '../../../../components/Editor';
import { getPost } from '../../../../lib/posts';

export const dynamic = 'force-dynamic';

export default async function EditPostPage({ params }) {
  const { slug } = await params;
  let post = null;
  try {
    post = getPost(slug);
  } catch {
    post = null;
  }
  if (!post) notFound();
  return (
    <>
      <h1>{post.title || post.slug}</h1>
      <p className="sub">
        <Link href="/">← All posts</Link>
        {'  ·  '}
        <span style={{ fontFamily: 'var(--mono)' }}>{post.slug}.mdx</span>
      </p>
      <Editor initial={post} />
    </>
  );
}
