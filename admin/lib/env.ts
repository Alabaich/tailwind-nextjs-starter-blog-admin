// Runtime configuration checks. Edge-safe (no Node APIs): the middleware
// imports this through lib/session.

const PLACEHOLDER_SECRETS = new Set(['replace-with-random-hex', 'change-me', 'changeme']);
const WEAK_PASSWORDS = new Set(['change-me', 'changeme', 'password', 'admin']);

export const MIN_SECRET_LENGTH = 32;
export const MIN_PASSWORD_LENGTH = 12;

/** Returns why a secret is unusable, or null when it is acceptable. */
export function secretProblem(name: string, value: string | undefined): string | null {
  if (!value) return `${name} is not set`;
  if (PLACEHOLDER_SECRETS.has(value)) return `${name} is still the placeholder value`;
  if (value.length < MIN_SECRET_LENGTH) {
    return `${name} must be at least ${MIN_SECRET_LENGTH} characters`;
  }
  return null;
}

export function passwordProblem(value: string | undefined): string | null {
  if (!value) return 'ADMIN_PASSWORD is not set';
  if (WEAK_PASSWORDS.has(value.toLowerCase())) {
    return 'ADMIN_PASSWORD is still a placeholder value';
  }
  if (value.length < MIN_PASSWORD_LENGTH) {
    return `ADMIN_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  return null;
}

function requireSecret(name: string, value: string | undefined): string {
  const problem = secretProblem(name, value);
  if (problem || !value) throw new Error(`${problem} (run ./setup.sh or: openssl rand -hex 32)`);
  return value;
}

// Static `process.env.X` reads on purpose: they work in every Next runtime.
export const sessionSecret = (): string =>
  requireSecret('SESSION_SECRET', process.env.SESSION_SECRET);

export const deployToken = (): string =>
  requireSecret('DEPLOY_TOKEN', process.env.DEPLOY_TOKEN);
