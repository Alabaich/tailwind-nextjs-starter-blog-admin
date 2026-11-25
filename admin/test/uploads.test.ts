import { afterEach, describe, expect, it, vi } from 'vitest';
import { maxUploadBytes, sniffImageType, UPLOAD_NAME_RE, uploadName } from '@/lib/uploads';

const bytes = (...parts: (number[] | string)[]) =>
  new Uint8Array(
    parts.flatMap((p) => (typeof p === 'string' ? [...p].map((c) => c.charCodeAt(0)) : p))
  );

afterEach(() => vi.unstubAllEnvs());

describe('sniffImageType', () => {
  it('recognises supported formats by magic bytes', () => {
    expect(sniffImageType(bytes([0x89], 'PNG', [0x0d, 0x0a, 0x1a, 0x0a, 0, 0]))).toBe('png');
    expect(sniffImageType(bytes([0xff, 0xd8, 0xff, 0xe0, 0, 0]))).toBe('jpg');
    expect(sniffImageType(bytes('GIF89a', [0, 0]))).toBe('gif');
    expect(sniffImageType(bytes('RIFF', [0, 0, 0, 0], 'WEBPVP8 '))).toBe('webp');
    expect(sniffImageType(bytes([0, 0, 0, 0x1c], 'ftypavif', [0, 0]))).toBe('avif');
  });

  it('rejects content that merely claims to be an image', () => {
    expect(sniffImageType(bytes('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>'))).toBeNull();
    expect(sniffImageType(bytes('<!doctype html><script>alert(1)</script>'))).toBeNull();
    expect(sniffImageType(bytes('RIFF', [0, 0, 0, 0], 'WAVEfmt '))).toBeNull();
    expect(sniffImageType(bytes([0, 0, 0, 0x1c], 'ftypisom'))).toBeNull();
    expect(sniffImageType(new Uint8Array())).toBeNull();
    expect(sniffImageType(bytes([0x89]))).toBeNull();
  });
});

describe('uploadName', () => {
  it('sanitizes the name and takes the extension from the content', () => {
    expect(uploadName('My Photo (1).PNG', 'jpg', 'ab12')).toBe('my-photo-1-ab12.jpg');
    expect(uploadName('shell.php.png', 'png', 'ab12')).toBe('shell-php-ab12.png');
  });

  it('cannot produce a path', () => {
    const name = uploadName('../../etc/passwd', 'png', 'ab12');
    expect(name).toBe('etc-passwd-ab12.png');
    expect(name).not.toMatch(/[/\\]|\.\./);
  });

  it('falls back when nothing usable is left', () => {
    expect(uploadName('фото.png', 'png', 'ab12')).toBe('image-ab12.png');
    expect(uploadName('', 'webp', 'ab12')).toBe('image-ab12.webp');
  });

  it('always yields a name the preview route will serve', () => {
    for (const original of ['a.png', 'x'.repeat(300), '---.gif', 'ünï côdé.jpeg']) {
      expect(uploadName(original, 'png', 'deadbeef')).toMatch(UPLOAD_NAME_RE);
    }
  });
});

describe('UPLOAD_NAME_RE', () => {
  it.each(['../secret.png', 'a/b.png', '.hidden.png', 'file.html', 'file.png/', 'a\\b.png'])(
    'rejects %s',
    (name) => {
      expect(UPLOAD_NAME_RE.test(name)).toBe(false);
    }
  );
});

describe('maxUploadBytes', () => {
  it('defaults to 8 MB and ignores nonsense', () => {
    expect(maxUploadBytes()).toBe(8 * 1024 * 1024);
    vi.stubEnv('MAX_UPLOAD_MB', '-5');
    expect(maxUploadBytes()).toBe(8 * 1024 * 1024);
    vi.stubEnv('MAX_UPLOAD_MB', '2');
    expect(maxUploadBytes()).toBe(2 * 1024 * 1024);
  });
});
