// Created by Haihs on 12/11/2026
// DELETE /api/templates/:id/purge: permanent delete, only for a template already in the trash.
import { withPermission } from '../../../../../src/lib/auth';
import { withErrors } from '../../../../../src/lib/handler';
import { purgeTemplate } from '../../../../../src/services/templates';

export const runtime = 'nodejs';

export const DELETE = withErrors(withPermission('template:purge', purgeTemplate));
