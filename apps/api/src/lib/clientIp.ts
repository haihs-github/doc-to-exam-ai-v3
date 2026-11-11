// Created by Haihs on 11/11/2026
// Client IP from X-Forwarded-For, honouring only the configured number of trusted proxies.
const UNKNOWN = 'unknown';

// trustProxy = number of trusted proxies in front of the app; 0 = ignore X-Forwarded-For entirely.
// shortcut: a Request carries no socket address, so with trustProxy=0 every client shares 'unknown'; production defaults to 1, set TRUST_PROXY when the topology differs
export function clientIp(req: Request, trustProxy: number): string {
  if (!Number.isInteger(trustProxy) || trustProxy < 1) return UNKNOWN;
  const parts = (req.headers.get('x-forwarded-for') ?? '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  if (!parts.length) return UNKNOWN;
  // Our trusted proxies append the address they saw, so count from the right: left entries are client-supplied.
  // Header shorter than trustProxy means a misconfiguration; the leftmost entry is the best remaining guess.
  return (parts[Math.max(0, parts.length - trustProxy)] ?? UNKNOWN).slice(0, 64);
}
