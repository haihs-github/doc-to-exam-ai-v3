// Created by Haihs on 11/11/2026
// Next startup hook: fail-fast env check, DB connect, indexes, RBAC seed, dummy-hash warmup (source server/index.js:30-39).
// Object so tests can spy on exit without killing the runner; process['exit'] avoids Next's static Edge-runtime warning (this only runs on nodejs).
export const startup = { exit: (code: number): never => process['exit'](code) };

// Same rule as env.ts: only exact development/test (or unset/empty) are relaxed.
const isProduction = () => {
  const raw = process.env.NODE_ENV;
  return !(raw === 'test' || !raw || raw === 'development');
};

export async function register(): Promise<void> {
  try {
    await boot();
  } catch (err) {
    // Next keeps serving 500s after a failed hook; in production exit so the orchestrator restarts/alerts.
    // Messages from loadEnv/connectDb name variables only (no values, URI or stack), so printing them is safe.
    if (!isProduction()) throw err;
    console.error(`Startup failed: ${err instanceof Error ? err.message : 'unknown error'}`);
    startup.exit(1);
  }
}

async function boot(): Promise<void> {
  // Not in the edge runtime and not while `next build` collects page data (build must work without secrets/DB).
  if (process.env.NEXT_RUNTIME !== 'nodejs' || process.env.NEXT_PHASE === 'phase-production-build')
    return;
  // Dynamic imports keep mongoose/bcrypt out of any non-node bundle.
  const { loadEnv } = await import('./src/lib/env');
  loadEnv(); // throws a names-only error: in production a missing secret stops the server from starting
  const { connectDb } = await import('./src/lib/db');
  await connectDb();
  const { ensureIndexes } = await import('./src/lib/ensureIndexes');
  await ensureIndexes(); // unique indexes before anything is seeded or served
  const { seedRbac } = await import('./src/lib/rbac');
  await seedRbac();
  const { compareDummy } = await import('./src/lib/passwordHash');
  await compareDummy('warmup').catch(() => {}); // best effort: the first unknown-phone login is not slower
}
