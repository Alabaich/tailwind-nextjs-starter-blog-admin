import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isAuthorized, tokenProblem } from '../src/auth.ts';

const TOKEN = 'a'.repeat(64);

test('accepts only the exact bearer token', () => {
  assert.equal(isAuthorized(`Bearer ${TOKEN}`, TOKEN), true);
  assert.equal(isAuthorized(`Bearer ${TOKEN}x`, TOKEN), false);
  assert.equal(isAuthorized(`Bearer ${TOKEN.slice(1)}`, TOKEN), false);
  assert.equal(isAuthorized(TOKEN, TOKEN), false);
  assert.equal(isAuthorized('', TOKEN), false);
  assert.equal(isAuthorized(undefined, TOKEN), false);
});

test('rejects missing, placeholder, and short tokens', () => {
  assert.match(tokenProblem(undefined) ?? '', /not set/);
  assert.match(tokenProblem('replace-with-random-hex') ?? '', /placeholder/);
  assert.match(tokenProblem('short') ?? '', /at least 32/);
  assert.equal(tokenProblem(TOKEN), null);
});
