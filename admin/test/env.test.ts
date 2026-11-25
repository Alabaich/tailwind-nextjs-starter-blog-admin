import { describe, expect, it } from 'vitest';
import { passwordProblem, secretProblem } from '@/lib/env';

describe('secretProblem', () => {
  it('accepts a long random value', () => {
    expect(secretProblem('X', 'f'.repeat(64))).toBeNull();
  });

  it('flags missing, placeholder and short values', () => {
    expect(secretProblem('X', undefined)).toMatch(/not set/);
    expect(secretProblem('X', '')).toMatch(/not set/);
    expect(secretProblem('X', 'replace-with-random-hex')).toMatch(/placeholder/);
    expect(secretProblem('X', 'abc123')).toMatch(/at least 32/);
  });
});

describe('passwordProblem', () => {
  it('accepts a 12+ character password', () => {
    expect(passwordProblem('correct horse battery')).toBeNull();
  });

  it('flags the .env.example placeholder and short passwords', () => {
    expect(passwordProblem(undefined)).toMatch(/not set/);
    expect(passwordProblem('change-me')).toMatch(/placeholder/);
    expect(passwordProblem('Change-Me')).toMatch(/placeholder/);
    expect(passwordProblem('short1')).toMatch(/at least 12/);
  });
});
