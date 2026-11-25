// Runs once when the Next.js server boots.
export async function register(): Promise<void> {
  // Keep this as a positive `if` block: the bundler statically drops it from
  // the edge build, which cannot load node:sqlite.
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    if (process.env.NEXT_PHASE === 'phase-production-build') return;
    const { startupCheck } = await import('./lib/startup');
    startupCheck();
  }
}
