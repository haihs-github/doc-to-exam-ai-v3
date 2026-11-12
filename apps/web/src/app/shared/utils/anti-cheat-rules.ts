// Created by Haihs on 12/11/2026
// Pure anti-cheat decisions: block/allow + log reason for clipboard/drag-drop actions, and the file-picker grace budget. Port of client/src/utils/antiCheatRules.js.

export type AntiCheatAction = 'paste' | 'drop' | 'copy' | 'cut' | 'contextmenu';

/**
 * Only when the sitting enables anti-cheat. Paste and drag-drop INTO an essay box are blocked and logged like elsewhere;
 * copy/cut/context menu INSIDE an essay box stay allowed (the student's own text), outside they are blocked. reason null = do not log.
 */
export function decideAntiCheatAction(i: {
  antiCheat: boolean;
  action: AntiCheatAction;
  inEssayInput: boolean;
}): { block: boolean; reason: string | null } {
  if (!i.antiCheat) return { block: false, reason: null };
  switch (i.action) {
    case 'paste':
      return {
        block: true,
        reason: i.inEssayInput
          ? 'Cố gắng dán (paste) nội dung vào ô bài tự luận'
          : 'Cố gắng dán (paste) nội dung',
      };
    case 'drop':
      return i.inEssayInput
        ? { block: true, reason: 'Cố gắng kéo-thả nội dung vào ô bài tự luận' }
        : { block: false, reason: null };
    case 'copy':
      return i.inEssayInput
        ? { block: false, reason: null }
        : { block: true, reason: 'Cố gắng sao chép nội dung bài thi' };
    case 'cut':
      return i.inEssayInput
        ? { block: false, reason: null }
        : { block: true, reason: 'Cố gắng cắt (cut) nội dung' };
    case 'contextmenu':
      return { block: !i.inEssayInput, reason: null };
    default:
      return { block: false, reason: null };
  }
}

export const FILE_PICKER_GRACE_MS = 1000; // slack after the file picker closes
export const FILE_PICKER_MAX_PER_OPEN_MS = 30000; // exempt at most this per opening
export const FILE_PICKER_MAX_TOTAL_MS = 30000; // exempt at most this in the whole exam
export const FILE_PICKER_ABUSE_REASON = 'Có hành vi mở trình duyệt file nhiều lần';

/** Called when the picker closes: accumulates the exempt time; over the per-opening or total cap gives the abuse reason. */
export function resolveFilePickerClose(i: { budgetUsedMs: number; durationMs: number }): {
  budgetUsedMs: number;
  reason: string | null;
} {
  const effective = Math.max(0, i.durationMs - FILE_PICKER_GRACE_MS);
  const used = i.budgetUsedMs + Math.min(effective, FILE_PICKER_MAX_PER_OPEN_MS);
  const over = effective > FILE_PICKER_MAX_PER_OPEN_MS || used > FILE_PICKER_MAX_TOTAL_MS;
  return {
    budgetUsedMs: Math.min(used, FILE_PICKER_MAX_TOTAL_MS),
    reason: over ? FILE_PICKER_ABUSE_REASON : null,
  };
}
