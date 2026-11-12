// Created by Haihs on 12/11/2026
// Invite tokens: generation, lazy atomic issue, rotate/enable, constant-time lookup for join. Port of classController.js invite/join.
import crypto from 'node:crypto';
import type { InviteDto } from '@doc-to-exam/contract';
import type { Types } from 'mongoose';
import { ClassModel } from '../models/Class';

export const KINDS = ['student', 'teacher'] as const;
export type InviteKind = (typeof KINDS)[number];
export const isKind = (k: unknown): k is InviteKind => KINDS.includes(k as InviteKind);
export const INVITE_TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

export const newInviteToken = (): string => crypto.randomBytes(32).toString('base64url');

/** Equal-length strings only (the caller already matched INVITE_TOKEN_RE); never throws on length mismatch. */
export const safeEqual = (a: string, b: string): boolean =>
  a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** Classes created before a token exists get one on first read; the filter makes it atomic (a parallel call loses the race harmlessly). */
async function ensureTokens(id: Types.ObjectId): Promise<void> {
  for (const k of KINDS)
    await ClassModel.updateOne(
      { _id: id, [`invite.${k}.token`]: { $exists: false } },
      { $set: { [`invite.${k}.token`]: newInviteToken(), [`invite.${k}.rotatedAt`]: new Date() } },
    );
}

/** The only place tokens leave the server; fields are copied one by one, the document is never serialised. */
export async function readInvite(id: Types.ObjectId): Promise<InviteDto> {
  await ensureTokens(id);
  const c = await ClassModel.findOne({ _id: id }).select(
    '+invite.student.token +invite.teacher.token',
  );
  if (!c) throw new Error('class vanished'); // class was resolved by the route a moment ago (deleted in between -> 500, never a leak)
  const side = (k: InviteKind) => ({
    token: c.invite[k].token as string,
    enabled: c.invite[k].enabled,
    rotatedAt: c.invite[k].rotatedAt?.toISOString(),
  });
  return { student: side('student'), teacher: side('teacher') };
}

/** One atomic update: the old token stops matching at once. */
export const rotateToken = (id: Types.ObjectId, kind: InviteKind) =>
  ClassModel.updateOne(
    { _id: id },
    {
      $set: {
        [`invite.${kind}.token`]: newInviteToken(),
        [`invite.${kind}.rotatedAt`]: new Date(),
      },
    },
  );

export const setEnabled = (id: Types.ObjectId, kind: InviteKind, enabled: boolean) =>
  ClassModel.updateOne({ _id: id }, { $set: { [`invite.${kind}.enabled`]: enabled } });

/**
 * Active (not deleted, not graduated) class whose enabled `kind` token equals `token`, else null.
 * The indexed lookup finds the candidate; the stored value is then re-checked in constant time.
 */
export async function findClassByToken(token: string, kind: InviteKind) {
  const c = await ClassModel.findOne({
    [`invite.${kind}.token`]: token,
    [`invite.${kind}.enabled`]: true,
    status: 'active',
  }).select(`name code startYear endYear status deletedAt +invite.${kind}.token`);
  const stored = c?.invite[kind].token;
  return c && stored && safeEqual(stored, token) ? c : null;
}
