import Link from 'next/link';
import PostList from '@/components/PostList';
import { listPosts } from '@/lib/posts';

export const dynamic = 'force-dynamic';

export default function PostsPage() {
  const posts = listPosts();
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Posts</h1>
          <p className="muted">
            Saving writes the file. Deploy rebuilds the site and swaps it in with no downtime.
          </p>
        </div>
        {posts.length > 0 && (
          <Link className="btn primary" href="/new">
            New post
          </Link>
        )}
      </div>
      <PostList posts={posts} />
    </>
  );
}
