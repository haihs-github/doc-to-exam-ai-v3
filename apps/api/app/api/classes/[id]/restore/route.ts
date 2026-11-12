// Created by Haihs on 12/11/2026
// POST /api/classes/:id/restore, body {code?}. Source: classController.js restoreClass.
import { ok } from '../../../../../src/lib/apiResponse';
import { toClassDto, mapCodeTaken } from '../../../../../src/lib/classDto';
import { withClassPermission } from '../../../../../src/lib/classAuth';
import { HttpError, readJson, withErrors } from '../../../../../src/lib/handler';
import { ClassModel } from '../../../../../src/models/Class';

export const runtime = 'nodejs';

export const POST = withErrors(
  withClassPermission(
    'class:restore',
    async (req, { classDoc }) => {
      const body = req.body ? await readJson(req, 4096) : {}; // body is optional
      const code = (body as { code?: unknown } | null)?.code;
      if (
        code !== undefined &&
        (typeof code !== 'string' || !code.trim() || code.trim().length > 30)
      )
        throw new HttpError('VALIDATION', 'Mã lớp phải có 1-30 ký tự.', { field: 'code' });
      await mapCodeTaken(
        async () => ClassModel.restoreWithCode(classDoc._id, { code }),
        'Mã lớp đã được lớp khác sử dụng, hãy nhập mã mới để khôi phục.',
      );
      const cls = await ClassModel.findOne({ _id: classDoc._id });
      if (!cls) throw new HttpError('NOT_FOUND', 'Không tìm thấy lớp.');
      return ok(toClassDto(cls));
    },
    { withDeleted: true },
  ),
);
