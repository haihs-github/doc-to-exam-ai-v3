// Created by Haihs on 15/11/2026
// Specs for the student result number formatting.
import { formatScoreOverMax, formatVnNumber } from './student-result';

describe('student-result', () => {
  it('formats numbers the Vietnamese way', () => {
    expect(formatVnNumber(8.5)).toBe('8,5');
    expect(formatVnNumber(7.75)).toBe('7,75');
    expect(formatVnNumber(10)).toBe('10');
    expect(formatVnNumber(null)).toBe('0');
  });
  it('shows nothing when a score is missing', () => {
    expect(formatScoreOverMax(6.5, 10)).toBe('6,5/10');
    expect(formatScoreOverMax(undefined, 10)).toBe('');
    expect(formatScoreOverMax(5, null)).toBe('');
  });
});
