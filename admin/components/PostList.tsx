'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { PostMeta } from '@/lib/posts';

type Filter = 'all' | 'published' | 'draft';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'published', label: 'Published' },
  { id: 'draft', label: 'Drafts' },
];

export default function PostList({ posts }: { posts: PostMeta[] }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const counts = useMemo(() => {
    const drafts = posts.filter((p) => p.draft).length;
    return { all: posts.length, draft: drafts, published: posts.length - drafts };
  }, [posts]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return posts.filter((p) => {
      if (filter === 'draft' && !p.draft) return false;
      if (filter === 'published' && p.draft) return false;
      if (!q) return true;
      return [p.title, p.slug, p.summary, ...p.tags].some((s) => s.toLowerCase().includes(q));
    });
  }, [posts, query, filter]);

  if (posts.length === 0) {
    return (
      <div className="empty">
        <h2>No posts yet</h2>
        <p>Posts are plain .mdx files in the starter&apos;s data/blog folder.</p>
        <Link className="btn primary" href="/new">
          Write the first post
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="list-controls">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search title, tag or slug"
          aria-label="Search posts"
        />
        <div className="segmented" role="group" aria-label="Filter posts">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
            >
              {f.label} <span className="count">{counts[f.id]}</span>
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="muted no-match">No posts match.</p>
      ) : (
        <ul className="posts">
          {visible.map((p) => (
            <li key={p.slug}>
              <Link href={`/edit/${p.slug}`} className="post-row">
                <span className="date">{p.date || '—'}</span>
                <span className="post-main">
                  <span className="post-title">{p.title}</span>
                  {p.summary && <span className="post-summary">{p.summary}</span>}
                </span>
                <span className="post-tags">
                  {p.tags.slice(0, 3).map((t) => (
                    <span className="tag" key={t}>
                      {t}
                    </span>
                  ))}
                  {p.draft && <span className="tag draft">draft</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
