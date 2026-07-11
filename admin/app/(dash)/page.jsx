import Link from 'next/link';
import { listPosts } from '../../lib/posts';

export const dynamic = 'force-dynamic';

export default function PostsPage() {
  const posts = listPosts();
  return (
    <>
      <h1>Posts</h1>
      <p className="sub">
        {posts.length} post{posts.length === 1 ? '' : 's'} in data/blog. Saving a
        post updates the file; Deploy rebuilds the site.
      </p>
      <div className="toolbar">
        <Link className="btn" href="/new">
          New post
        </Link>
      </div>
      {posts.length === 0 && (
        <p className="sub">No posts yet. Write the first one.</p>
      )}
      {posts.map((p) => (
        <div className="post-row" key={p.slug}>
          <span className="date">{p.date || '—'}</span>
          <Link className="title" href={`/edit/${p.slug}`}>
            {p.title}
          </Link>
          {p.draft && <span className="tag-draft">draft</span>}
        </div>
      ))}
    </>
  );
}
