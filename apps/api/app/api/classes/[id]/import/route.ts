// Created by Haihs on 12/11/2026
// POST /api/classes/:id/import (multipart field "file", .csv <= 256KB or .xlsx <= 1MB, <= 200 rows). Source: importStudents.
import { ok } from '../../../../../src/lib/apiResponse';
import { withClassPermission } from '../../../../../src/lib/classAuth';
import { readImportFile } from '../../../../../src/lib/fileSniff';
import { withErrors } from '../../../../../src/lib/handler';
import { LIMITERS } from '../../../../../src/lib/limiters';
import { parseCsv } from '../../../../../src/lib/csvParse';
import { withRateLimit } from '../../../../../src/lib/rateLimit';
import { parseXlsx, XlsxError } from '../../../../../src/lib/xlsxParse';
import { HttpError } from '../../../../../src/lib/handler';
import { assertAccepting } from '../../../../../src/services/memberHandlers';
import { importStudents, rowsFromRecords } from '../../../../../src/services/importStudents';

export const runtime = 'nodejs';

// Limiter INSIDE the permission wrapper (by user); the file is read only after both checks pass (a blocked request is never buffered).
export const POST = withErrors(
  withClassPermission(
    'student:import',
    withRateLimit([LIMITERS.CSV_IMPORT], async (req, { classDoc, user }) => {
      assertAccepting(classDoc);
      const { buffer, kind } = await readImportFile(req);
      let records: string[][] | null;
      if (kind === 'xlsx') {
        try {
          records = await parseXlsx(buffer);
        } catch (err) {
          if (err instanceof XlsxError) throw new HttpError('CSV_INVALID', err.message);
          throw err;
        }
      } else {
        let text: string;
        try {
          text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
        } catch {
          throw new HttpError('CSV_INVALID', 'File phải mã hóa UTF-8.');
        }
        records = parseCsv(text);
        if (!records)
          throw new HttpError('CSV_INVALID', 'File CSV bị lỗi định dạng (ngoặc kép không đóng).');
      }
      const result = await importStudents(classDoc._id, user._id, rowsFromRecords(records));
      const res = ok(result); // temp passwords: shown once, never cached
      res.headers.set('Cache-Control', 'no-store');
      return res;
    }),
  ),
);
