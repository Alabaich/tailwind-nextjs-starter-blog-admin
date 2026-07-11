import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import matter from 'gray-matter';

const CONTENT_DIR = process.env.CONTENT_DIR || '/content';
// When SITE_DIR points at the starter checkout, every save/delete/upload is
// recorded as a local git commit — free content history and undo.
const SITE_DIR = process.env.SITE_DIR || '';
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function gitCommit(message) {
  if (!SITE_DIR) return;
  const git = (args) =>
    execFileSync('git', ['-c', `safe.directory=${SITE_DIR}`, '-C', SITE_DIR, ...args], {
      stdio: 'ignore',
    });
  try {
    git(['add', '-A', '--', 'data/blog', 'public/static/images/uploads']);
    git([
      '-c', 'user.name=blog-admin',
      '-c', 'user.email=blog-admin@localhost',
      'commit', '-m', message, '--no-verify',
    ]);
  } catch {
    // Nothing staged, or git unavailable — history is best-effort and must
    // never block a save.
  }
}

// Ukrainian official romanization first, generic Cyrillic as fallback.
const CYR = {
  а: 'a', б: 'b', в: 'v', г: 'h', ґ: 'g', д: 'd', е: 'e', є: 'ie', ж: 'zh',
  з: 'z', и: 'y', і: 'i', ї: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n',
  о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts',
  ч: 'ch', ш: 'sh', щ: 'shch', ю: 'iu', я: 'ia', ь: '', "'": '',
  ё: 'e', ъ: '', ы: 'y', э: 'e',
};

export function slugify(title) {
  return String(title)
    .toLowerCase()
    .replace(/[\u0400-\u04ff']/g, (ch) => CYR[ch] ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96);
}

function assertSlug(slug) {
  if (!SLUG_RE.test(slug)) throw new Error(`Invalid slug: ${slug}`);
}

function fileFor(slug) {
  assertSlug(slug);
  for (const ext of ['.mdx', '.md']) {
    const p = path.join(CONTENT_DIR, slug + ext);
    if (fs.existsSync(p)) return p;
  }
  return path.join(CONTENT_DIR, slug + '.mdx');
}

export function listPosts() {
  if (!fs.existsSync(CONTENT_DIR)) return [];
  return fs
    .readdirSync(CONTENT_DIR)
    .filter((f) => f.endsWith('.mdx') || f.endsWith('.md'))
    .map((f) => {
      const slug = f.replace(/\.mdx?$/, '');
      try {
        const { data } = matter(fs.readFileSync(path.join(CONTENT_DIR, f), 'utf8'));
        return {
          slug,
          title: data.title || slug,
          date: data.date ? String(data.date).slice(0, 10) : '',
          draft: Boolean(data.draft),
          summary: data.summary || '',
          tags: Array.isArray(data.tags) ? data.tags : [],
        };
      } catch {
        return { slug, title: slug, date: '', draft: false, summary: '', tags: [] };
      }
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function getPost(slug) {
  const p = fileFor(slug);
  if (!fs.existsSync(p)) return null;
  const { data, content } = matter(fs.readFileSync(p, 'utf8'));
  return {
    slug,
    title: data.title || '',
    date: data.date ? String(data.date).slice(0, 10) : '',
    tags: Array.isArray(data.tags) ? data.tags : [],
    summary: data.summary || '',
    draft: Boolean(data.draft),
    content,
  };
}

// Frontmatter fields mirror the starter's schema exactly:
// title, date, tags, draft, summary. Nothing custom on top.
export function savePost({ slug, title, date, tags, summary, draft, content }) {
  assertSlug(slug);
  const data = {
    title: String(title || slug),
    date: String(date || new Date().toISOString().slice(0, 10)),
    tags: (Array.isArray(tags) ? tags : String(tags || '').split(','))
      .map((t) => String(t).trim())
      .filter(Boolean),
    draft: Boolean(draft),
    summary: String(summary || ''),
  };
  fs.mkdirSync(CONTENT_DIR, { recursive: true });
  fs.writeFileSync(fileFor(slug), matter.stringify(String(content || ''), data));
  gitCommit(`post: save ${slug}`);
  return { slug };
}

export function deletePost(slug) {
  const p = fileFor(slug);
  if (fs.existsSync(p)) {
    fs.unlinkSync(p);
    gitCommit(`post: delete ${slug}`);
  }
}

export function postExists(slug) {
  assertSlug(slug);
  return ['.mdx', '.md'].some((ext) =>
    fs.existsSync(path.join(CONTENT_DIR, slug + ext))
  );
}
