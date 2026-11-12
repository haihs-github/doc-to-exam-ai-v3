// Created by Haihs on 12/11/2026
// Builds the "Kết quả ca thi" sheet (pure, testable without opening a file) and writes it as an .xlsx buffer with write-excel-file. Port of server/utils/resultsXlsx.js.
import { formatTimeSecondsDate } from './dateFormat';

export const RESULTS_XLSX_MAX_ROWS = 5000;
export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const DEFAULT_MAX_SCORE = 10;
const FORMULA_START = /^[\s\p{Cc}\p{Cf}]*[=+\-@]|^[\t\r]/u;
const BORDER = { borderStyle: 'thin', borderColor: '#000000' } as const;

/** User-typed strings get a leading ' when Excel could read them as a formula. */
export const sanitizeCell = (value: unknown): string => {
  const text = value === null || value === undefined ? '' : String(value);
  return FORMULA_START.test(text) ? `'${text}` : text;
};

const fmt = (n: unknown): string => String(Math.round((Number(n) || 0) * 100) / 100);
const roundScore = (n: unknown): number => Math.round((Number(n) || 0) * 100) / 100;

type Cell = Record<string, unknown> | null;
const text = (value: unknown, extra: Record<string, unknown> = {}): Cell => ({
  type: String,
  value: sanitizeCell(value),
  ...BORDER,
  alignVertical: 'center',
  wrap: true,
  ...extra,
});
const num = (value: unknown, extra: Record<string, unknown> = {}): Cell =>
  typeof value === 'number' && Number.isFinite(value)
    ? { type: Number, value, ...BORDER, alignVertical: 'center', align: 'center', ...extra }
    : { ...BORDER }; // an empty cell still has its border
const head = (value: unknown, extra: Record<string, unknown> = {}): Cell =>
  text(value, { fontWeight: 'bold', align: 'center', backgroundColor: '#D9E1F2', ...extra });

interface ExportSubmission {
  studentName: string;
  classNames?: string[];
  totalQuestions?: number;
  correctCount?: number;
  mcqScore?: number;
  score: number;
  maxScore?: number;
  hasEssay?: boolean;
  essayGraded?: boolean;
  essayScore?: number;
  essayStale?: boolean;
  essayResults?: { questionId: number; criteria?: { key: string; score: number }[] }[];
  totalScore?: number | null;
  violationCount?: number;
  timeSpentSeconds?: number;
  submittedAt?: Date | string;
}
export interface SheetInput {
  sittingTitle: string;
  essayQuestions?: {
    id: number;
    number: number;
    maxScore: number;
    rubric: { key: string; label: string; max: number }[];
  }[];
  submissions?: ExportSubmission[];
  notSubmitted?: { studentName: string; hasSession?: boolean; inClass?: boolean }[];
  hasMcq?: boolean;
}

export function buildResultsSheet({
  sittingTitle,
  essayQuestions = [],
  submissions = [],
  notSubmitted = [],
  hasMcq = true,
}: SheetInput) {
  const essays = essayQuestions;
  const hasEssay = essays.length > 0;
  const multi = essays.length >= 2;
  const maxScore =
    submissions.reduce((m, s) => Math.max(m, Number(s.maxScore) || 0), 0) || DEFAULT_MAX_SCORE;
  const criteria = essays.flatMap((q) =>
    (q.rubric ?? []).map((item) => ({
      q,
      item,
      label: `${multi ? `Câu ${q.number} - ` : ''}${item.label} (tối đa ${fmt(item.max)})`,
    })),
  );
  const essayMax = essays.reduce((sum, q) => sum + (Number(q.maxScore) || 0), 0);

  const top: Cell[] = [
    head('STT', { rowSpan: 2 }),
    head('Họ và Tên', { rowSpan: 2 }),
    head('Lớp', { rowSpan: 2 }),
  ];
  const sub: Cell[] = [null, null, null];
  const group = (title: string, children: string[]) => {
    top.push(head(title, { columnSpan: children.length }), ...children.slice(1).map(() => null));
    sub.push(...children.map((c) => head(c)));
  };
  if (hasMcq) group('Phần I. Trắc nghiệm', ['Tổng số câu', 'Số câu đúng', 'Điểm trắc nghiệm']);
  if (hasEssay)
    group('Phần II. Tự luận', [
      ...criteria.map((c) => c.label),
      `Điểm tự luận (tối đa ${fmt(essayMax)})`,
    ]);
  const single = (title: string) => {
    top.push(head(title, { rowSpan: 2 }));
    sub.push(null);
  };
  single(
    hasEssay
      ? `Tổng điểm trắc nghiệm + tự luận (Thang điểm ${fmt(maxScore)})`
      : `Điểm số (Thang điểm ${fmt(maxScore)})`,
  );
  ['Số vi phạm', 'Thời gian làm bài (phút)', 'Thời gian nộp', 'Ghi chú'].forEach(single);
  const width = top.length;

  const banner: Cell[][] = ['TRƯỜNG: ......', 'PHÂN HIỆU: ......', sittingTitle, 'MÔN: ......'].map(
    (value) => [
      {
        type: String,
        value: sanitizeCell(value),
        fontWeight: 'bold',
        align: 'center',
        columnSpan: width,
      },
      ...Array<Cell>(width - 1).fill(null),
    ],
  );

  let stt = 0;
  const rows: Cell[][] = submissions.map((s) => {
    stt += 1;
    const doneEssay = hasEssay && s.hasEssay === true;
    const cells: Cell[] = [
      num(stt),
      text(s.studentName),
      text((s.classNames ?? []).filter(Boolean).join(', ')),
    ];
    if (hasMcq)
      cells.push(
        num(s.totalQuestions),
        num(s.correctCount),
        num(s.hasEssay ? roundScore(s.mcqScore ?? s.score) : roundScore(s.score), {
          format: '0.00',
        }),
      );
    if (hasEssay) {
      for (const { q, item } of criteria) {
        const result = doneEssay ? (s.essayResults ?? []).find((r) => r.questionId === q.id) : null;
        cells.push(
          num(result ? (result.criteria ?? []).find((c) => c.key === item.key)?.score : null, {
            format: '0.00',
          }),
        );
      }
      cells.push(
        num(doneEssay && s.essayGraded ? roundScore(s.essayScore) : null, { format: '0.00' }),
      );
    }
    let note = '';
    if (s.essayStale) note = 'Cần chấm lại (đề đổi)';
    else if (doneEssay && !s.essayGraded) note = 'Chờ chấm';
    const minutes = s.timeSpentSeconds ? Math.round((s.timeSpentSeconds / 60) * 10) / 10 : null;
    cells.push(
      num(typeof s.totalScore === 'number' ? s.totalScore : null, { format: '0.00' }),
      num(s.violationCount ?? 0),
      num(minutes),
      text(formatTimeSecondsDate(s.submittedAt)),
      text(note),
    );
    return cells;
  });
  for (const item of notSubmitted) {
    stt += 1;
    const cells: Cell[] = Array.from({ length: width }, () => num(null));
    cells[0] = num(stt);
    cells[1] = text(item.studentName);
    cells[2] = text('');
    cells[width - 1] = text(
      [item.hasSession ? 'Đã vào chưa nộp' : 'Chưa vào', item.inClass ? '' : 'Không còn trong lớp']
        .filter(Boolean)
        .join('; '),
    );
    rows.push(cells);
  }
  const columns = Array.from({ length: width }, () => ({ width: 14 }));
  columns[0] = { width: 6 };
  columns[1] = { width: 28 };
  columns[2] = { width: 14 };
  columns[width - 1] = { width: 24 };
  columns[width - 2] = { width: 20 };
  return {
    data: [...banner, top, sub, ...rows],
    columns,
    headerRows: banner.length + 2,
    columnCount: width,
  };
}

/** Safe file name (no / \\ : * ? " < > | or control characters, spaces -> _, cut at 100). */
export const safeFileName = (name: unknown): string =>
  String(name ?? '')
    .replace(/[\\/:*?"<>|\p{Cc}]/gu, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 100) || 'ca_thi';

/** Content-Disposition: an ASCII fallback plus RFC 5987 filename* (UTF-8, also escaping ' ( ) *). */
export function contentDisposition(title: unknown): string {
  const full = `Ket_qua_${safeFileName(title)}.xlsx`;
  const ascii = full
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^A-Za-z0-9._-]/g, '_');
  const encoded = encodeURIComponent(full).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

export async function renderXlsx(sheet: {
  data: Cell[][];
  columns: { width: number }[];
}): Promise<Buffer> {
  const { default: writeXlsxFile } = await import('write-excel-file/node');
  const out = await (
    writeXlsxFile as unknown as (d: unknown, o: unknown) => { toBuffer(): Promise<Buffer> }
  )(sheet.data, {
    columns: sheet.columns,
    sheet: 'Kết quả',
  }).toBuffer();
  return out;
}
