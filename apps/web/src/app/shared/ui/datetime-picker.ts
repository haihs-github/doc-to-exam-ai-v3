// Created by Haihs on 15/11/2026
// <app-datetime-picker>: custom calendar + hour/minute steppers popup (Vietnamese, Monday first), anchored under an element. Port of DateTimePicker.jsx; value is yyyy-MM-ddTHH:mm.
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { Icon } from './icon';

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const VALUE_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
const WIDTH = 320;
const GAP = 4;
const pad = (n: number): string => String(n).padStart(2, '0');

interface Parts {
  y: number;
  mo: number;
  d: number;
  h: number;
  mi: number;
}
export const parsePicker = (v: string): Parts | null => {
  const m = VALUE_RE.exec(v || '');
  return m ? { y: +m[1], mo: +m[2] - 1, d: +m[3], h: +m[4], mi: +m[5] } : null;
};
export const formatPicker = (p: Parts): string =>
  `${p.y}-${pad(p.mo + 1)}-${pad(p.d)}T${pad(p.h)}:${pad(p.mi)}`;
export const wrapNumber = (n: number, size: number): number => ((n % size) + size) % size;

/** The 42 cells of a month (Monday first), including the overflow days of the neighbour months. */
export const monthCells = (y: number, mo: number) => {
  const offset = (new Date(y, mo, 1).getDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, i) => {
    const dt = new Date(y, mo, 1 - offset + i);
    return {
      y: dt.getFullYear(),
      mo: dt.getMonth(),
      d: dt.getDate(),
      inMonth: dt.getMonth() === mo,
    };
  });
};

/** Current Vietnam wall-clock time (UTC+7) as parts. */
const nowParts = (): Parts => {
  const t = new Date(Date.now() + 7 * 3600_000);
  return {
    y: t.getUTCFullYear(),
    mo: t.getUTCMonth(),
    d: t.getUTCDate(),
    h: t.getUTCHours(),
    mi: t.getUTCMinutes(),
  };
};

@Component({
  selector: 'app-datetime-picker',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'dialog',
    'aria-label': 'Chọn ngày giờ',
    class:
      'fixed z-50 rounded-lg border border-gray-200 bg-white p-3 shadow-overlay dark:border-gray-700 dark:bg-gray-800 dark:shadow-overlay-dark',
    '[style.top.px]': 'pos().top',
    '[style.left.px]': 'pos().left',
    '[style.width.px]': 'pos().width',
    '[style.visibility]': 'pos().visible ? "visible" : "hidden"',
  },
  template: `
    <div class="mb-2 flex items-center justify-between">
      <button
        type="button"
        aria-label="Tháng trước"
        (click)="shiftMonth(-1)"
        class="inline-flex h-10 w-10 items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-700"
      >
        <app-icon name="chevron-left" svgClass="h-5 w-5" />
      </button>
      <div class="text-base font-semibold text-gray-900 dark:text-gray-100" aria-live="polite">
        Tháng {{ view().mo + 1 }} / {{ view().y }}
      </div>
      <button
        type="button"
        aria-label="Tháng sau"
        (click)="shiftMonth(1)"
        class="inline-flex h-10 w-10 items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-700"
      >
        <app-icon name="chevron-right" svgClass="h-5 w-5" />
      </button>
    </div>
    <div
      class="grid grid-cols-7 text-center text-sm font-semibold text-gray-500 dark:text-gray-400"
    >
      @for (w of weekdays; track w) {
        <div class="py-1">{{ w }}</div>
      }
    </div>
    <div class="grid grid-cols-7 gap-y-0.5 text-center">
      @for (c of cells(); track c.y + '-' + c.mo + '-' + c.d) {
        <button
          type="button"
          (click)="pickDay(c)"
          [attr.aria-pressed]="isSelected(c)"
          [attr.aria-label]="c.d + '/' + (c.mo + 1) + '/' + c.y"
          class="mx-auto inline-flex h-10 w-10 items-center justify-center rounded text-base"
          [class]="dayCls(c)"
        >
          {{ c.d }}
        </button>
      }
    </div>
    <div
      class="mt-3 flex items-center justify-between gap-2 border-t border-gray-200 pt-3 dark:border-gray-700"
    >
      <div class="flex items-center gap-1" role="group" aria-label="giờ">
        <button
          type="button"
          aria-label="Giảm giờ"
          (click)="setHour(time().h - 1)"
          [class]="stepBtn"
        >
          <app-icon name="minus" svgClass="h-4 w-4" />
        </button>
        <span
          class="w-10 text-center font-mono text-lg font-semibold text-gray-900 dark:text-gray-100"
          aria-live="polite"
          >{{ p2(time().h) }}</span
        >
        <button
          type="button"
          aria-label="Tăng giờ"
          (click)="setHour(time().h + 1)"
          [class]="stepBtn"
        >
          <app-icon name="plus" svgClass="h-4 w-4" />
        </button>
      </div>
      <span class="text-lg font-semibold text-gray-500" aria-hidden="true">:</span>
      <div class="flex items-center gap-1" role="group" aria-label="phút">
        <button
          type="button"
          aria-label="Giảm phút"
          (click)="setMinute(time().mi - 5)"
          [class]="stepBtn"
        >
          <app-icon name="minus" svgClass="h-4 w-4" />
        </button>
        <span
          class="w-10 text-center font-mono text-lg font-semibold text-gray-900 dark:text-gray-100"
          aria-live="polite"
          >{{ p2(time().mi) }}</span
        >
        <button
          type="button"
          aria-label="Tăng phút"
          (click)="setMinute(time().mi + 5)"
          [class]="stepBtn"
        >
          <app-icon name="plus" svgClass="h-4 w-4" />
        </button>
      </div>
    </div>
    <div class="mt-3 flex items-center justify-between gap-2">
      <button
        type="button"
        (click)="valueChange.emit(''); closed.emit()"
        class="min-h-[44px] rounded px-3 text-base font-semibold text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
      >
        Xóa
      </button>
      <button
        type="button"
        (click)="now()"
        class="min-h-[44px] rounded px-3 text-base font-semibold text-primary-800 hover:bg-primary-50 dark:text-sky-300 dark:hover:bg-sky-900/30"
      >
        Bây giờ
      </button>
      <button
        type="button"
        (click)="closed.emit()"
        class="min-h-[44px] rounded bg-primary-700 px-4 text-base font-semibold text-white hover:bg-primary-800 dark:bg-sky-400 dark:text-gray-900 dark:hover:bg-sky-300"
      >
        Xong
      </button>
    </div>
  `,
})
export class DatetimePicker {
  /** yyyy-MM-ddTHH:mm or ''. */
  readonly value = input('');
  /** Element the popup hangs under. */
  readonly anchor = input.required<HTMLElement>();
  readonly valueChange = output<string>();
  readonly closed = output<void>();

  protected readonly weekdays = WEEKDAYS;
  protected readonly p2 = pad;
  protected readonly stepBtn =
    'inline-flex h-10 w-10 items-center justify-center rounded border border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700';
  private readonly today = nowParts();
  private readonly start = parsePicker(this.value()) ?? this.today;
  protected readonly view = signal({ y: this.start.y, mo: this.start.mo });
  protected readonly time = signal({ h: this.start.h, mi: this.start.mi });
  protected readonly pos = signal({ top: 0, left: 0, width: WIDTH, visible: false });
  protected readonly cells = computed(() => monthCells(this.view().y, this.view().mo));
  private readonly current = computed(() => parsePicker(this.value()));
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    const reposition = (): void => {
      const a = this.anchor().getBoundingClientRect();
      const box = this.host.nativeElement.getBoundingClientRect();
      const width = Math.min(WIDTH, window.innerWidth - 16);
      const left = Math.max(8, Math.min(a.left, window.innerWidth - width - 8));
      const below = a.bottom + GAP;
      const above = a.top - GAP - box.height;
      const top =
        below + box.height <= window.innerHeight - 8
          ? below
          : above >= 8
            ? above
            : Math.max(8, window.innerHeight - box.height - 8);
      this.pos.set({ top, left, width, visible: true });
    };
    afterNextRender(reposition);
    const close = (): void => this.closed.emit();
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close();
    };
    const onDown = (e: Event): void => {
      const t = e.target as Node;
      if (!this.host.nativeElement.contains(t) && !this.anchor().contains(t)) close();
    };
    const onScroll = (e: Event): void => {
      if (!this.host.nativeElement.contains(e.target as Node)) close();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', close);
    inject(DestroyRef).onDestroy(() => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', close);
    });
  }

  protected isSelected(c: { y: number; mo: number; d: number }): boolean {
    const cur = this.current();
    return Boolean(cur && cur.y === c.y && cur.mo === c.mo && cur.d === c.d);
  }
  protected dayCls(c: { y: number; mo: number; d: number; inMonth: boolean }): string {
    const sel = this.isSelected(c);
    const isToday = this.today.y === c.y && this.today.mo === c.mo && this.today.d === c.d;
    return sel
      ? 'bg-primary-700 font-semibold text-white dark:bg-sky-400 dark:text-gray-900'
      : `${c.inMonth ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-600'} hover:bg-primary-50 dark:hover:bg-sky-900/30${isToday ? ' border border-primary-700 dark:border-sky-400' : ''}`;
  }
  protected shiftMonth(delta: number): void {
    const v = this.view();
    const dt = new Date(v.y, v.mo + delta, 1);
    this.view.set({ y: dt.getFullYear(), mo: dt.getMonth() });
  }
  protected pickDay(c: { y: number; mo: number; d: number }): void {
    this.view.set({ y: c.y, mo: c.mo });
    this.valueChange.emit(formatPicker({ y: c.y, mo: c.mo, d: c.d, ...this.time() }));
  }
  protected setHour(h: number): void {
    this.changeTime({ h: wrapNumber(h, 24) });
  }
  protected setMinute(mi: number): void {
    this.changeTime({ mi: wrapNumber(mi, 60) });
  }
  private changeTime(patch: Partial<{ h: number; mi: number }>): void {
    const next = { ...this.time(), ...patch };
    this.time.set(next);
    const cur = this.current();
    if (cur) this.valueChange.emit(formatPicker({ ...cur, ...next })); // only written once a day is chosen
  }
  protected now(): void {
    const t = nowParts();
    this.view.set({ y: t.y, mo: t.mo });
    this.time.set({ h: t.h, mi: t.mi });
    this.valueChange.emit(formatPicker(t));
  }
}
