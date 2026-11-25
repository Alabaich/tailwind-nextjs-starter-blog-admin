import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { gitCommit } from './history';
import { isValidSlug } from './slug';

export interface PostMeta {
  slug: string;
  title: string;
  date: string;
  draft: boolean;
  summary: string;
  tags: string[];
}

export interface Post extends PostMeta {
  content: string;
}

export interface PostInput {
  title: string;
  date: string;
  tags: string[];
  summary: string;
  draft: boolean;
  content: string;
}

/** Thrown for bad user input; its message is safe to return to the client. */
export class ValidationError extends Error {}

const LIMITS = { title: 200, summary: 500, tags: 20, tag: 50, content: 1_000_000 };
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const EXTENSIONS = ['.mdx', '.md'] as const;

// Read lazily so tests (and anything else) can point at a different directory.
const contentDir = (): string => process.env.CONTENT_DIR || '/content';
const uploadDir = (): string => process.env.UPLOAD_DIR || '/uploads';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function assertSlug(slug: string): void {
  if (!isValidSlug(slug)) {
    throw new ValidationError('Slug may only contain lowercase letters, digits and hyphens');
  }
}

function existingFile(slug: string): string | null {
  assertSlug(slug);
  for (const ext of EXTENSIONS) {
    const file = path.join(contentDir(), slug + ext);
    if (fs.existsSync(file)) return file;
  }
  return null;
}

/**
 * YAML turns an unquoted `date: 2024-01-31` into a Date object, and
 * String(Date) is "Wed Jan 31 2024 ...", so dates need explicit handling.
 */
function normalizeDate(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const text = typeof value === 'string' ? value.slice(0, 10) : '';
  return DATE_RE.test(text) ? text : '';
}

function toMeta(slug: string, data: Record<string, unknown>): PostMeta {
  return {
    slug,
    title: typeof data.title === 'string' && data.title ? data.title : slug,
    date: normalizeDate(data.date),
    draft: data.draft === true,
    summary: typeof data.summary === 'string' ? data.summary : '',
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
  };
}

// Passing an options object opts out of gray-matter's result cache, which
// hands out shared mutable objects.
function parse(file: string): matter.GrayMatterFile<string> {
  return matter(fs.readFileSync(file, 'utf8'), {});
}

function str(value: unknown, field: string, max: number): string {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') throw new ValidationError(`${field} must be text`);
  if (value.length > max) throw new ValidationError(`${field} is too long (max ${max} characters)`);
  return value;
}

/** Validates and normalizes untrusted input from the API. */
export function parsePostInput(raw: Record<string, unknown>): PostInput {
  const title = str(raw.title, 'Title', LIMITS.title).trim();
  if (!title) throw new ValidationError('Title is required');

  const date = str(raw.date, 'Date', 10) || today();
  if (!DATE_RE.test(date) || Number.isNaN(Date.parse(date))) {
    throw new ValidationError('Date must be a valid YYYY-MM-DD date');
  }

  const rawTags = Array.isArray(raw.tags) ? raw.tags : str(raw.tags, 'Tags', 2000).split(',');
  const tags = [...new Set(rawTags.map((t) => String(t).trim()).filter(Boolean))];
  if (tags.length > LIMITS.tags) throw new ValidationError(`At most ${LIMITS.tags} tags`);
  if (tags.some((t) => t.length > LIMITS.tag)) {
    throw new ValidationError(`Tags are limited to ${LIMITS.tag} characters each`);
  }

  if (raw.draft !== undefined && typeof raw.draft !== 'boolean') {
    throw new ValidationError('Draft must be true or false');
  }

  return {
    title,
    date,
    tags,
    summary: str(raw.summary, 'Summary', LIMITS.summary).trim(),
    draft: raw.draft === true,
    content: str(raw.content, 'Body', LIMITS.content),
  };
}

export function listPosts(): PostMeta[] {
  const dir = contentDir();
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => EXTENSIONS.some((ext) => name.endsWith(ext)))
    .map((name) => {
      const slug = name.replace(/\.mdx?$/, '');
      try {
        return toMeta(slug, parse(path.join(dir, name)).data);
      } catch {
        // Unparseable frontmatter: still list it so it can be opened and fixed.
        return toMeta(slug, {});
      }
    })
    .sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));
}

export function postExists(slug: string): boolean {
  return existingFile(slug) !== null;
}

export function getPost(slug: string): Post | null {
  const file = existingFile(slug);
  if (!file) return null;
  const { data, content } = parse(file);
  const meta = toMeta(slug, data);
  return {
    ...meta,
    title: typeof data.title === 'string' ? data.title : '',
    // Drop the blank line that conventionally follows the frontmatter fence.
    content: content.replace(/^\r?\n/, ''),
  };
}

/**
 * Writes the post. Only the five fields the admin edits are touched; any
 * other frontmatter the starter supports (authors, images, layout, lastmod,
 * canonicalUrl, ...) is carried over untouched.
 */
export function savePost(slug: string, input: PostInput): void {
  assertSlug(slug);
  const dir = contentDir();
  const file = existingFile(slug) ?? path.join(dir, `${slug}.mdx`);
  const existing = fs.existsSync(file) ? parse(file).data : {};
  const data = {
    ...existing,
    title: input.title,
    date: input.date,
    tags: input.tags,
    draft: input.draft,
    summary: input.summary,
  };
  fs.mkdirSync(dir, { recursive: true });
  // Write-then-rename: a crash mid-write must not leave a truncated post that
  // breaks the next site build.
  const tmp = path.join(dir, `.${slug}.${process.pid}.tmp`);
  fs.writeFileSync(tmp, matter.stringify(input.content, data));
  fs.renameSync(tmp, file);
  gitCommit(`post: save ${slug}`);
}

/** Returns false when there was nothing to delete. */
export function deletePost(slug: string): boolean {
  const file = existingFile(slug);
  if (!file) return false;
  fs.unlinkSync(file);
  gitCommit(`post: delete ${slug}`);
  return true;
}

/**
 * Latest modification time across posts and uploads, used to tell whether the
 * live site is behind the files on disk. Directory mtimes are included so
 * deletions count too.
 */
export function contentChangedAt(): Date | null {
  let latest = 0;
  for (const dir of [contentDir(), uploadDir()]) {
    try {
      latest = Math.max(latest, fs.statSync(dir).mtimeMs);
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isFile() || entry.name.startsWith('.')) continue;
        latest = Math.max(latest, fs.statSync(path.join(dir, entry.name)).mtimeMs);
      }
    } catch {
      // directory missing: nothing to compare
    }
  }
  return latest ? new Date(latest) : null;
}
