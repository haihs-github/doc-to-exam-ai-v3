// Created by Haihs on 12/11/2026
// Extract a 43-char invite token from a pasted token or a /join/<token> link (any origin); port of inviteToken.js.
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;
const LINK_RE = /\/join\/([A-Za-z0-9_-]{43})(?=[/?#]|$)/;

/** Format check only (the server decides validity): the token, or null for anything else. */
export function parseInviteToken(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const text = input.trim();
  if (TOKEN_RE.test(text)) return text;
  return LINK_RE.exec(text)?.[1] ?? null;
}
