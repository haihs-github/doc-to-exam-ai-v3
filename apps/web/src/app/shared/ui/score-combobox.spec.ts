// Created by Haihs on 15/11/2026
// Specs for the score combobox helpers.
import { commaScore, filterScoreOptions, scoreOptions } from './score-combobox';

describe('score-combobox helpers', () => {
  it('lists 0, 0.25 ... up to the cap', () => {
    expect(scoreOptions(1)).toEqual([0, 0.25, 0.5, 0.75, 1]);
    expect(scoreOptions(0)).toEqual([0]);
  });
  it('shows scores with a comma', () => {
    expect(commaScore(0.25)).toBe('0,25');
    expect(commaScore(2)).toBe('2');
  });
  it('filters by the typed prefix (dot or comma)', () => {
    expect(filterScoreOptions([0, 0.25, 0.5, 0.75, 1], '0,2')).toEqual([0.25]);
    expect(filterScoreOptions([0, 0.25, 0.5], '0.5')).toEqual([0.5]);
    expect(filterScoreOptions([0, 0.25], '')).toEqual([0, 0.25]);
  });
});
