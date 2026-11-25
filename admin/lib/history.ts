import { execFileSync } from 'node:child_process';

/**
 * When SITE_DIR points at the starter checkout, every save/delete/upload is
 * recorded as a local git commit: free content history and undo.
 *
 * History is best-effort and must never block or fail a save.
 */
export function gitCommit(message: string): void {
  const siteDir = process.env.SITE_DIR;
  if (!siteDir) return;
  const git = (args: string[]) =>
    execFileSync('git', ['-c', `safe.directory=${siteDir}`, '-C', siteDir, ...args], {
      stdio: 'ignore',
      timeout: 10_000,
    });
  try {
    git(['add', '-A', '--', 'data/blog', 'public/static/images/uploads']);
    git([
      '-c', 'user.name=blog-admin',
      '-c', 'user.email=blog-admin@localhost',
      'commit', '-m', message, '--no-verify',
    ]);
  } catch {
    // Nothing staged, or git unavailable.
  }
}
