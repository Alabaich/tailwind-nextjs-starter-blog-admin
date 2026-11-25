import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  contentChangedAt,
  deletePost,
  getPost,
  listPosts,
  parsePostInput,
  postExists,
  savePost,
  ValidationError,
} from '@/lib/posts';
import type { PostInput } from '@/lib/posts';

let dir: string;

const input = (over: Partial<PostInput> = {}): PostInput => ({
  title: 'Hello',
  date: '2026-01-15',
  tags: ['a', 'b'],
  summary: 'Sum',
  draft: false,
  content: '# Body\n',
  ...over,
});

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bg-posts-'));
  vi.stubEnv('CONTENT_DIR', path.join(dir, 'blog'));
  vi.stubEnv('UPLOAD_DIR', path.join(dir, 'uploads'));
  vi.stubEnv('SITE_DIR', ''); // no git history in tests
});

afterEach(() => {
  vi.unstubAllEnvs();
  fs.rmSync(dir, { recursive: true, force: true });
});

const file = (name: string) => path.join(dir, 'blog', name);

describe('save / get / list / delete', () => {
  it('round-trips a post', () => {
    savePost('hello', input());
    expect(postExists('hello')).toBe(true);
    expect(getPost('hello')).toEqual({ slug: 'hello', ...input() });
    expect(listPosts().map((p) => p.slug)).toEqual(['hello']);
    expect(deletePost('hello')).toBe(true);
    expect(getPost('hello')).toBeNull();
    expect(deletePost('hello')).toBe(false);
  });

  it('keeps frontmatter fields the admin does not edit', () => {
    fs.mkdirSync(path.join(dir, 'blog'), { recursive: true });
    fs.writeFileSync(
      file('rich.mdx'),
      [
        '---',
        "title: 'Old'",
        "date: '2023-01-01'",
        'tags: [x]',
        'draft: false',
        'summary: old',
        "authors: ['default', 'sparrowhawk']",
        'images: [/static/a.png]',
        'layout: PostBanner',
        'canonicalUrl: https://example.com/x',
        '---',
        'body',
      ].join('\n')
    );
    savePost('rich', input({ title: 'New' }));
    const raw = fs.readFileSync(file('rich.mdx'), 'utf8');
    expect(raw).toMatch(/title: New/);
    expect(raw).toMatch(/sparrowhawk/);
    expect(raw).toMatch(/layout: PostBanner/);
    expect(raw).toMatch(/canonicalUrl: ['"]?https:\/\/example\.com\/x/);
    expect(raw).toMatch(/images:/);
  });

  it('updates an existing .md file in place instead of adding a .mdx twin', () => {
    fs.mkdirSync(path.join(dir, 'blog'), { recursive: true });
    fs.writeFileSync(file('legacy.md'), '---\ntitle: Legacy\n---\nold');
    savePost('legacy', input());
    expect(fs.existsSync(file('legacy.md'))).toBe(true);
    expect(fs.existsSync(file('legacy.mdx'))).toBe(false);
  });

  it('reads unquoted YAML dates as YYYY-MM-DD', () => {
    fs.mkdirSync(path.join(dir, 'blog'), { recursive: true });
    fs.writeFileSync(file('dated.mdx'), '---\ntitle: Dated\ndate: 2024-01-31\n---\nx');
    expect(getPost('dated')?.date).toBe('2024-01-31');
    expect(listPosts()[0]?.date).toBe('2024-01-31');
  });

  it('writes dates so they read back as the same string', () => {
    savePost('d', input({ date: '2026-03-04' }));
    expect(getPost('d')?.date).toBe('2026-03-04');
  });

  it('lists newest first and survives broken frontmatter', () => {
    savePost('old', input({ date: '2020-01-01' }));
    savePost('new', input({ date: '2026-01-01' }));
    fs.writeFileSync(file('broken.mdx'), '---\ntitle: [unclosed\n---\nx');
    fs.writeFileSync(file('notes.txt'), 'ignored');
    expect(listPosts().map((p) => p.slug)).toEqual(['new', 'old', 'broken']);
  });

  it('leaves no temp files behind', () => {
    savePost('clean', input());
    expect(fs.readdirSync(path.join(dir, 'blog'))).toEqual(['clean.mdx']);
  });
});

describe('path safety', () => {
  it.each(['../escape', 'a/b', '..', 'x.mdx', 'UPPER', ''])('rejects slug %j', (slug) => {
    expect(() => savePost(slug, input())).toThrow(ValidationError);
    expect(() => getPost(slug)).toThrow(ValidationError);
    expect(() => deletePost(slug)).toThrow(ValidationError);
    expect(() => postExists(slug)).toThrow(ValidationError);
  });

  it('never writes outside the content directory', () => {
    expect(() => savePost('../../pwned', input())).toThrow();
    expect(fs.readdirSync(dir)).toEqual([]);
  });
});

describe('parsePostInput', () => {
  it('normalizes a typical payload', () => {
    expect(
      parsePostInput({
        title: '  Hi  ',
        date: '2026-02-03',
        tags: 'one, two,, one ',
        summary: ' s ',
        draft: true,
        content: 'c',
      })
    ).toEqual({
      title: 'Hi',
      date: '2026-02-03',
      tags: ['one', 'two'],
      summary: 's',
      draft: true,
      content: 'c',
    });
  });

  it('defaults date to today and draft to false', () => {
    const parsed = parsePostInput({ title: 'T' });
    expect(parsed.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(parsed.draft).toBe(false);
    expect(parsed.content).toBe('');
  });

  it.each([
    [{}, /Title is required/],
    [{ title: '   ' }, /Title is required/],
    [{ title: 5 }, /Title must be text/],
    [{ title: 'x'.repeat(201) }, /too long/],
    [{ title: 'T', date: '2026-13-45' }, /valid YYYY-MM-DD/],
    [{ title: 'T', date: 'yesterday' }, /valid YYYY-MM-DD/],
    [{ title: 'T', draft: 'yes' }, /Draft must be/],
    [{ title: 'T', content: { $ne: 1 } }, /Body must be text/],
    [{ title: 'T', content: 'x'.repeat(1_000_001) }, /too long/],
    [{ title: 'T', tags: Array.from({ length: 21 }, (_, i) => `t${i}`) }, /At most 20 tags/],
    [{ title: 'T', tags: ['x'.repeat(51)] }, /50 characters/],
  ])('rejects %j', (raw, message) => {
    expect(() => parsePostInput(raw as Record<string, unknown>)).toThrow(message);
    expect(() => parsePostInput(raw as Record<string, unknown>)).toThrow(ValidationError);
  });
});

describe('contentChangedAt', () => {
  it('is null before anything exists', () => {
    expect(contentChangedAt()).toBeNull();
  });

  it('moves forward on save, upload and delete', () => {
    const at = (iso: string, target: string) => {
      const t = new Date(iso);
      fs.utimesSync(target, t, t);
    };
    savePost('a', input());
    at('2026-01-01T00:00:00Z', file('a.mdx'));
    at('2026-01-01T00:00:00Z', path.join(dir, 'blog'));
    expect(contentChangedAt()?.toISOString()).toBe('2026-01-01T00:00:00.000Z');

    fs.mkdirSync(path.join(dir, 'uploads'));
    fs.writeFileSync(path.join(dir, 'uploads', 'pic.png'), 'x');
    at('2026-02-01T00:00:00Z', path.join(dir, 'uploads', 'pic.png'));
    at('2026-02-01T00:00:00Z', path.join(dir, 'uploads'));
    expect(contentChangedAt()?.toISOString()).toBe('2026-02-01T00:00:00.000Z');

    // A deletion bumps the directory mtime to "now".
    deletePost('a');
    expect(contentChangedAt()!.getTime()).toBeGreaterThan(Date.parse('2026-02-01T00:00:00Z'));
  });
});
