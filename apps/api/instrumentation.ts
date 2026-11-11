// Created by Haihs on 11/11/2026
// Next startup hook: fail-fast env check, DB connect, indexes, RBAC seed, dummy-hash warmup (source server/index.js:30-39).
export async function register(): Promise<void> {
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
