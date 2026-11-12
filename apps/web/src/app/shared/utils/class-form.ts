// Created by Haihs on 12/11/2026
// Client-side class form rules (name/code length, school years); port of classRules.js validateClassForm/validateSchoolYear.
import { validateMaxLength } from './limits';

export type ClassFormValue = {
  name: unknown;
  code: unknown;
  startYear: unknown;
  endYear: unknown;
};
export type ClassFormField = 'name' | 'code' | 'startYear' | 'endYear';
export type FormErrors = Partial<Record<ClassFormField, string>>;
/** Top-to-bottom field order on screen (focus the first error). */
export const CLASS_FORM_ORDER: ClassFormField[] = ['name', 'code', 'startYear', 'endYear'];

const MIN_YEAR = 2000;
const MAX_START_YEAR = 2100;
const MAX_SPAN = 12; // end year therefore <= 2112

/** The code is stored upper-case (server does the same); use on input. */
export const upperClassCode = (s: string): string => s.toLocaleUpperCase('vi');

const text = (v: unknown): string => String(v ?? '').trim();
const yearField = (raw: unknown, label: string): string =>
  text(raw) === '' || !Number.isInteger(Number(text(raw))) ? `${label} phải là số nguyên.` : '';

/** Map {field: message}; empty map = valid. A bad span is attached to endYear. */
export function validateClassForm(v: ClassFormValue): FormErrors {
  const errors: FormErrors = {};
  const name = text(v.name);
  const code = text(v.code);
  if (!name) errors.name = 'Vui lòng nhập tên lớp.';
  else errors.name = validateMaxLength(name, 'CLASS_NAME_MAX', 'Tên lớp') || undefined;
  if (!code) errors.code = 'Vui lòng nhập mã lớp.';
  else errors.code = validateMaxLength(code, 'CLASS_CODE_MAX', 'Mã lớp') || undefined;
  const startErr = yearField(v.startYear, 'Năm bắt đầu');
  const endErr = yearField(v.endYear, 'Năm kết thúc');
  if (startErr) errors.startYear = startErr;
  if (endErr) errors.endYear = endErr;
  if (!startErr && !endErr) {
    const start = Number(text(v.startYear));
    const span = Number(text(v.endYear)) - start;
    if (start < MIN_YEAR || start > MAX_START_YEAR) {
      errors.startYear = `Năm bắt đầu từ ${MIN_YEAR} đến ${MAX_START_YEAR}.`;
    } else if (span < 1 || span > MAX_SPAN) {
      errors.endYear = `Niên khóa phải kéo dài từ 1 đến ${MAX_SPAN} năm.`;
    }
  }
  for (const k of CLASS_FORM_ORDER) if (errors[k] === undefined) delete errors[k];
  return errors;
}
