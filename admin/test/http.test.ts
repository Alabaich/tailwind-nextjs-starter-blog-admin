import { describe, expect, it } from 'vitest';
import { BodyError, clientIp, isSameOrigin, readJsonObject } from '@/lib/http';

describe('isSameOrigin (CSRF guard)', () => {
  it('lets safe methods through without an Origin', () => {
    expect(isSameOrigin('GET', null, 'admin.test')).toBe(true);
    expect(isSameOrigin('head', null, 'admin.test')).toBe(true);
  });

  it('accepts a matching origin, port included', () => {
    expect(isSameOrigin('POST', 'http://localhost:8081', 'localhost:8081')).toBe(true);
    expect(isSameOrigin('DELETE', 'https://admin.test', 'admin.test')).toBe(true);
  });

  it('rejects the blog on the same host but another port', () => {
    expect(isSameOrigin('POST', 'http://localhost:8080', 'localhost:8081')).toBe(false);
  });

  it('rejects other sites, missing and malformed origins', () => {
    expect(isSameOrigin('POST', 'https://evil.test', 'admin.test')).toBe(false);
    expect(isSameOrigin('POST', null, 'admin.test')).toBe(false);
    expect(isSameOrigin('POST', 'null', 'admin.test')).toBe(false);
    expect(isSameOrigin('PUT', 'not a url', 'admin.test')).toBe(false);
    expect(isSameOrigin('POST', 'https://admin.test.evil.test', 'admin.test')).toBe(false);
  });

  it('honours X-Forwarded-Host from a fronting proxy', () => {
    expect(isSameOrigin('POST', 'https://admin.test', 'admin:3000', 'admin.test')).toBe(true);
    expect(isSameOrigin('POST', 'https://evil.test', 'admin:3000', 'admin.test')).toBe(false);
  });
});

describe('clientIp', () => {
  it('uses the hop appended by our proxy, not client-supplied ones', () => {
    expect(clientIp(new Headers({ 'x-forwarded-for': '1.1.1.1, 203.0.113.9' }))).toBe(
      '203.0.113.9'
    );
    expect(clientIp(new Headers({ 'x-forwarded-for': '203.0.113.9' }))).toBe('203.0.113.9');
    expect(clientIp(new Headers())).toBe('unknown');
  });
});

describe('readJsonObject', () => {
  const req = (body: string, headers: Record<string, string> = {}) =>
    new Request('http://x/api', { method: 'POST', body, headers });

  it('parses an object', async () => {
    expect(await readJsonObject(req('{"a":1}'), 100)).toEqual({ a: 1 });
  });

  it('rejects invalid JSON and non-objects with 400', async () => {
    for (const body of ['{oops', '[1,2]', '"text"', 'null']) {
      await expect(readJsonObject(req(body), 100)).rejects.toMatchObject({ status: 400 });
    }
  });

  it('rejects oversized bodies with 413, even without a truthful Content-Length', async () => {
    const big = JSON.stringify({ a: 'x'.repeat(200) });
    await expect(readJsonObject(req(big), 100)).rejects.toBeInstanceOf(BodyError);
    await expect(readJsonObject(req(big, { 'content-length': '5' }), 100)).rejects.toMatchObject({
      status: 413,
    });
  });
});
