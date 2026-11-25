import { getDb } from './db';
import { secretProblem } from './env';

/**
 * Fail fast on unsafe configuration: a forgeable session secret or a
 * guessable admin password is worse than a container that refuses to start.
 */
export function startupCheck(): void {
  const problems = [
    secretProblem('SESSION_SECRET', process.env.SESSION_SECRET),
    secretProblem('DEPLOY_TOKEN', process.env.DEPLOY_TOKEN),
  ].filter((p): p is string => p !== null);

  if (problems.length === 0) {
    try {
      getDb(); // opens the database and seeds the admin account on first boot
    } catch (err) {
      problems.push(err instanceof Error ? err.message : String(err));
    }
  }

  if (problems.length > 0) {
    for (const problem of problems) console.error(`[config] ${problem}`);
    console.error('[config] Refusing to start. Run ./setup.sh or fix .env, then restart.');
    process.exit(1);
  }
}
