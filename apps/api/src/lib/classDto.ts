// Created by Haihs on 12/11/2026
// Class response DTO and duplicate-code detection shared by the class routes.
import type { ClassDto } from '@doc-to-exam/contract';
import { HttpError } from './handler';

interface ClassLike {
  _id: unknown;
  name: string;
  code: string;
  startYear: number;
  endYear: number;
  status: 'active' | 'graduated';
  deletedAt?: Date | null;
}

export const toClassDto = <E extends object>(c: ClassLike, extra?: E) =>
  ({
    id: String(c._id),
    name: c.name,
    code: c.code,
    startYear: c.startYear,
    endYear: c.endYear,
    status: c.status,
    deletedAt: c.deletedAt ? c.deletedAt.toISOString() : null,
    ...extra,
  }) as Omit<ClassDto, 'studentCount' | 'teacherCount'> & Partial<ClassDto> & E;

const isCodeDuplicate = (err: unknown): boolean => {
  const e = err as { code?: unknown; keyPattern?: Record<string, unknown> } | null;
  return (
    e?.code === 11000 &&
    !!e.keyPattern &&
    ('activeCodeKey' in e.keyPattern || 'codeKey' in e.keyPattern)
  );
};

/** Runs a write; a duplicate class code becomes 409 CLASS_CODE_TAKEN (field code). */
export async function mapCodeTaken<T>(
  op: () => Promise<T>,
  message = 'Mã lớp đã được dùng. Hãy chọn mã khác.',
): Promise<T> {
  try {
    return await op();
  } catch (err) {
    if (isCodeDuplicate(err)) throw new HttpError('CLASS_CODE_TAKEN', message, { field: 'code' });
    throw err;
  }
}
