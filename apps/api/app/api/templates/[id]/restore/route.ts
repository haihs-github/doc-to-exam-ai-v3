// Created by Haihs on 12/11/2026
// POST /api/templates/:id/restore {title?}: bring a trashed template back (before purgeAt).
import { withPermission } from '../../../../../src/lib/auth';
import { withErrors } from '../../../../../src/lib/handler';
import { restoreTemplate } from '../../../../../src/services/templates';

export const runtime = 'nodejs';

export const POST = withErrors(withPermission('template:restore', restoreTemplate));
