// Created by Haihs on 12/11/2026
// <app-formatted-text>: shows exam text with the few inline tags the source keeps (<u>, <strong>, <em>, <del>, <br>) WITHOUT innerHTML.
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export interface TextPart {
  text: string;
  tag: 'u' | 'strong' | 'em' | 'del' | null;
  br?: boolean;
}

const TAG_RE = /<(\/?)(u|strong|em|del|b|i|br)\s*\/?>/gi;
const ALIAS: Record<string, TextPart['tag']> = {
  u: 'u',
  strong: 'strong',
  b: 'strong',
  em: 'em',
  i: 'em',
  del: 'del',
};

/** Splits text into plain parts; unknown tags stay as literal text (never interpreted), so no markup can run. */
export function parseFormatted(raw: unknown): TextPart[] {
  const src = String(raw ?? '');
  const parts: TextPart[] = [];
  const open: NonNullable<TextPart['tag']>[] = [];
  let last = 0;
  for (const m of src.matchAll(TAG_RE)) {
    if (m.index > last)
      parts.push({ text: src.slice(last, m.index), tag: open[open.length - 1] ?? null });
    const name = m[2].toLowerCase();
    if (name === 'br') parts.push({ text: '', tag: null, br: true });
    else if (m[1]) {
      const tag = ALIAS[name];
      const i = open.lastIndexOf(tag as never);
      if (i !== -1) open.splice(i, 1);
    } else open.push(ALIAS[name] as NonNullable<TextPart['tag']>);
    last = m.index + m[0].length;
  }
  if (last < src.length) parts.push({ text: src.slice(last), tag: open[open.length - 1] ?? null });
  return parts;
}

@Component({
  selector: 'app-formatted-text',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@for (p of parts(); track $index) {
    @if (p.br) {
      <br />
    } @else {
      <span
        [textContent]="p.text"
        [class.underline]="p.tag === 'u'"
        [class.font-bold]="p.tag === 'strong'"
        [class.italic]="p.tag === 'em'"
        [class.line-through]="p.tag === 'del'"
      ></span>
    }
  }`,
  host: { class: 'whitespace-pre-wrap break-words' },
})
export class FormattedText {
  readonly text = input<unknown>('');
  protected readonly parts = computed(() => parseFormatted(this.text()));
}
