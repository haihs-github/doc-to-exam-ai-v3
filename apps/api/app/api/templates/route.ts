// Created by Haihs on 12/11/2026
// GET /api/templates (list active|deleted), POST (create). Owner-scoped. Source: templateRoutes.js.
import { withPermission } from '../../../src/lib/auth';
import { withErrors } from '../../../src/lib/handler';
import { createTemplate, listTemplates } from '../../../src/services/templates';

export const runtime = 'nodejs';

export const GET = withErrors(withPermission('template:list', listTemplates));
export const POST = withErrors(withPermission('template:create', createTemplate));
