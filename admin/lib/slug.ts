// Pure and dependency-free: shared by the server and the editor (which shows
// the slug a title will produce before the post is saved).

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const MAX_SLUG_LENGTH = 96;

// Ukrainian official romanization first, generic Cyrillic as fallback.
const CYR: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'h', ґ: 'g', д: 'd', е: 'e', є: 'ie', ж: 'zh',
  з: 'z', и: 'y', і: 'i', ї: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n',
  о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts',
  ч: 'ch', ш: 'sh', щ: 'shch', ю: 'iu', я: 'ia', ь: '', "'": '',
  ё: 'e', ъ: '', ы: 'y', э: 'e',
};

export function slugify(title: string): string {
  return String(title)
    .toLowerCase()
    .replace(/[Ѐ-ӿ']/g, (ch) => CYR[ch] ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/^-+|-+$/g, '');
}

export function isValidSlug(slug: unknown): slug is string {
  return typeof slug === 'string' && slug.length <= MAX_SLUG_LENGTH && SLUG_RE.test(slug);
}
