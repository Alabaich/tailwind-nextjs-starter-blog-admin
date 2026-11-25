import { describe, expect, it } from 'vitest';
import { isValidSlug, MAX_SLUG_LENGTH, slugify } from '@/lib/slug';

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Hello, World!')).toBe('hello-world');
    expect(slugify('  --Already--sluggy--  ')).toBe('already-sluggy');
  });

  it('romanizes Ukrainian', () => {
    expect(slugify('Привіт, світе')).toBe('pryvit-svite');
    expect(slugify('Їжак і щука')).toBe('izhak-i-shchuka');
    expect(slugify("М'ята")).toBe('miata');
  });

  it('strips diacritics', () => {
    expect(slugify('Crème brûlée')).toBe('creme-brulee');
  });

  it('never ends with a hyphen after truncation', () => {
    const slug = slugify(`${'a'.repeat(MAX_SLUG_LENGTH - 1)} b c`);
    expect(slug.length).toBeLessThanOrEqual(MAX_SLUG_LENGTH);
    expect(isValidSlug(slug)).toBe(true);
  });

  it('returns an empty string when nothing is usable', () => {
    expect(slugify('日本語')).toBe('');
    expect(slugify('!!!')).toBe('');
  });
});

describe('isValidSlug', () => {
  it.each(['a', 'my-post', 'post-2', '2024-review'])('accepts %s', (slug) => {
    expect(isValidSlug(slug)).toBe(true);
  });

  it.each([
    '',
    '../etc/passwd',
    'a/b',
    'a\\b',
    'Upper',
    'trailing-',
    '-leading',
    'double--hyphen',
    'dot.mdx',
    'nul\0byte',
    'a'.repeat(MAX_SLUG_LENGTH + 1),
  ])('rejects %j', (slug) => {
    expect(isValidSlug(slug)).toBe(false);
  });

  it('rejects non-strings', () => {
    expect(isValidSlug(undefined)).toBe(false);
    expect(isValidSlug(42)).toBe(false);
    expect(isValidSlug(['a'])).toBe(false);
  });
});
