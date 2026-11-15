// Created by Haihs on 15/11/2026
// Specs for the datetime field helpers and the picker's month grid.
import { monthCells, formatPicker, parsePicker, wrapNumber } from './datetime-picker';
import { pickerToText, textToPicker } from './datetime-field';

describe('datetime field helpers', () => {
  it('converts between the typed text and the picker value', () => {
    expect(textToPicker('25/12/2026 08:30')).toBe('2026-12-25T08:30');
    expect(pickerToText('2026-12-25T08:30')).toBe('25/12/2026 08:30');
    expect(textToPicker('25/12/2026 08')).toBe('');
    expect(pickerToText('')).toBe('');
  });
  it('parses / formats picker values', () => {
    const p = parsePicker('2026-01-05T09:05');
    expect(p).toEqual({ y: 2026, mo: 0, d: 5, h: 9, mi: 5 });
    expect(formatPicker(p!)).toBe('2026-01-05T09:05');
    expect(parsePicker('bad')).toBeNull();
  });
  it('wraps hours and minutes', () => {
    expect(wrapNumber(-1, 24)).toBe(23);
    expect(wrapNumber(60, 60)).toBe(0);
  });
  it('lays out 42 cells starting on Monday', () => {
    const cells = monthCells(2026, 10); // 1 Nov 2026 is a Sunday: 6 leading days
    expect(cells).toHaveLength(42);
    expect(cells[0]).toMatchObject({ y: 2026, mo: 9, d: 26, inMonth: false });
    expect(cells[6]).toMatchObject({ mo: 10, d: 1, inMonth: true });
  });
});
