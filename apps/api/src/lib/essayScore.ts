// Created by Haihs on 12/11/2026
// Essay score step (teachers grade in 0.25 steps). Port of server/utils/essayGrading.js constants.

export const SCORE_STEP = 0.25;

/** Value is a multiple of SCORE_STEP (float-safe). */
export const isQuarterStep = (value: number): boolean =>
  Math.abs(value / SCORE_STEP - Math.round(value / SCORE_STEP)) < 1e-9;
