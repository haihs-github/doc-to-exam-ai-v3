// Created by Haihs on 12/11/2026
// Vietnamese upper-casing helper for class name/code (port of toUpperVi in server/models/Class.js:13).

/** NFC + trim + upper-case with the Vietnamese locale ("lớp đặc biệt" -> "LỚP ĐẶC BIỆT"). */
export const toUpperVi = (str: string): string =>
  str.normalize('NFC').trim().toLocaleUpperCase('vi');
