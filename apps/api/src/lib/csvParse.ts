// Created by Haihs on 12/11/2026
// Small RFC 4180 CSV parser (BOM, quotes, CRLF/LF/CR, newline inside a cell) for the student import. Port of server/utils/csvParse.js.

/** Records (arrays of cells) or null when a quote is never closed. */
export function parseCsv(text: string): string[][] | null {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  // Excel in vi/EU locales exports ';'. Names are validated to contain neither, so guessing from the first line is enough.
  const firstLine = src.split(/\r\n|\n|\r/, 1)[0];
  const delimiter = firstLine.includes(';') && !firstLine.includes(',') ? ';' : ',';
  const records: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  const endCell = () => {
    row.push(cell);
    cell = '';
  };
  const endRow = () => {
    endCell();
    records.push(row);
    row = [];
  };
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (inQuotes) {
      if (ch !== '"') cell += ch;
      else if (src[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else inQuotes = false;
    } else if (ch === '"' && cell === '') inQuotes = true;
    else if (ch === delimiter) endCell();
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i += 1;
      endRow();
    } else cell += ch;
  }
  if (inQuotes) return null;
  if (cell !== '' || row.length) endRow();
  return records;
}
