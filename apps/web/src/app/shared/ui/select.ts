// Created by Haihs on 12/11/2026
// <app-select>: single-value dropdown (combobox button + listbox) with keyboard + typeahead (port of Select.jsx).
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  computed,
  inject,
  input,
  model,
  signal,
} from '@angular/core';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

const TYPEAHEAD_RESET_MS = 700;
let nextId = 0;

/** New active index after ArrowDown/ArrowUp/Home/End, skipping disabled; -1 when none selectable. */
export const nextActiveIndex = (
  key: string,
  current: number,
  count: number,
  isDisabled: (i: number) => boolean | undefined = () => false,
): number => {
  if (!count) return -1;
  const step = (from: number, dir: number): number => {
    for (let n = 1; n <= count; n += 1) {
      const i = (from + dir * n + count * (n + 1)) % count;
      if (!isDisabled(i)) return i;
    }
    return -1;
  };
  if (key === 'ArrowDown') return step(current, 1);
  if (key === 'ArrowUp') return step(current < 0 ? 0 : current, -1);
  if (key === 'Home') return !isDisabled(0) ? 0 : step(0, 1);
  if (key === 'End') return !isDisabled(count - 1) ? count - 1 : step(count - 1, -1);
  return current;
};

/** Enabled option whose label starts with buffer (case-insensitive), cycling. 1 char starts AFTER `from`. */
export const typeaheadIndex = (options: SelectOption[], buffer: string, from = -1): number => {
  const text = buffer.toLowerCase();
  if (!text || !options.length) return -1;
  const start = text.length === 1 ? from + 1 : Math.max(from, 0);
  for (let n = 0; n < options.length; n += 1) {
    const i = (start + n) % options.length;
    if (!options[i].disabled && options[i].label.toLowerCase().startsWith(text)) return i;
  }
  return -1;
};

const TRIGGER =
  'flex min-h-[48px] w-full cursor-pointer items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2 text-left text-base text-gray-900 shadow-field focus:outline-none focus:ring-2 focus:ring-primary-700 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:bg-gray-900 dark:text-gray-100 dark:shadow-field-dark dark:focus:ring-sky-400 dark:disabled:bg-gray-800';

@Component({
  selector: 'app-select',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      #btn
      type="button"
      role="combobox"
      aria-haspopup="listbox"
      [attr.id]="inputId() || null"
      [attr.aria-expanded]="open()"
      [attr.aria-controls]="open() ? uid + '-list' : null"
      [attr.aria-activedescendant]="open() && active() >= 0 ? uid + '-opt-' + active() : null"
      [attr.aria-label]="label() || null"
      [attr.aria-invalid]="invalid() || null"
      [disabled]="disabled()"
      (click)="open() ? open.set(false) : openList()"
      (keydown)="onKeyDown($event)"
      [class]="trigger + (invalid() ? ' border-red-600' : ' border-gray-300 dark:border-gray-600')"
    >
      <span
        [class]="selectedIndex() < 0 ? 'truncate text-gray-500 dark:text-gray-400' : 'truncate'"
        >{{ shown() }}</span
      >
      <svg
        class="h-5 w-5 shrink-0 text-gray-500 dark:text-gray-400"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        aria-hidden="true"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </button>
    @if (open()) {
      <ul
        [id]="uid + '-list'"
        role="listbox"
        [attr.aria-label]="label() || null"
        class="absolute z-20 mt-1 max-h-[50vh] w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-overlay dark:border-gray-700 dark:bg-gray-800 dark:shadow-overlay-dark sm:max-h-72"
      >
        @for (o of options(); track o.value; let i = $index) {
          <!-- keyboard is handled on the combobox (aria-activedescendant), options are not tab stops -->
          <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events, @angular-eslint/template/interactive-supports-focus -->
          <li
            [id]="uid + '-opt-' + i"
            role="option"
            [attr.aria-selected]="i === selectedIndex()"
            [attr.aria-disabled]="o.disabled || null"
            (mousedown)="$event.preventDefault()"
            (click)="pick(i)"
            (mouseenter)="!o.disabled && active.set(i)"
            [class]="itemClass(i, o)"
          >
            {{ o.label }}
          </li>
        }
      </ul>
    }
  `,
  host: { class: 'relative block', '(document:pointerdown)': 'onDown($event)' },
})
export class Select implements OnDestroy {
  readonly options = input.required<SelectOption[]>();
  readonly value = model('');
  readonly label = input('');
  readonly placeholder = input('Chọn');
  readonly inputId = input('');
  readonly disabled = input(false);
  readonly invalid = input(false);
  protected readonly uid = `app-select-${nextId++}`;
  protected readonly trigger = TRIGGER;
  protected readonly open = signal(false);
  protected readonly active = signal(-1);
  protected readonly selectedIndex = computed(() =>
    this.options().findIndex((o) => o.value === this.value()),
  );
  protected readonly shown = computed(
    () => this.options()[this.selectedIndex()]?.label ?? this.placeholder(),
  );
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private typed = '';
  private timer: ReturnType<typeof setTimeout> | undefined;

  ngOnDestroy(): void {
    clearTimeout(this.timer);
  }

  protected itemClass(i: number, o: SelectOption): string {
    return [
      'flex min-h-[44px] items-center px-3 py-2.5 text-base',
      o.disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
      i === this.active() && 'bg-gray-100 dark:bg-gray-700',
      i === this.selectedIndex() && 'font-medium text-primary-800 dark:text-sky-300',
    ]
      .filter(Boolean)
      .join(' ');
  }

  private dis = (i: number) => this.options()[i].disabled;

  protected openList(): void {
    const sel = this.selectedIndex();
    this.active.set(sel >= 0 ? sel : nextActiveIndex('Home', -1, this.options().length, this.dis));
    this.open.set(true);
  }

  private close(): void {
    this.open.set(false);
    this.host.querySelector<HTMLElement>('[role="combobox"]')!.focus();
  }

  protected pick(i: number): void {
    const o = this.options()[i];
    if (!o || o.disabled) return;
    this.value.set(o.value);
    this.close();
  }

  protected onDown(e: Event): void {
    if (this.open() && !this.host.contains(e.target as Node)) this.open.set(false);
  }

  protected onKeyDown(e: KeyboardEvent): void {
    if (this.disabled()) return;
    const n = this.options().length;
    if (e.key === 'Escape') {
      if (this.open()) {
        e.preventDefault();
        this.close();
      }
    } else if (e.key === 'Tab') {
      this.open.set(false);
    } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
      e.preventDefault();
      if (!this.open()) this.openList();
      else this.active.update((cur) => nextActiveIndex(e.key, cur, n, this.dis));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!this.open()) this.openList();
      else this.pick(this.active());
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      clearTimeout(this.timer);
      this.typed += e.key;
      this.timer = setTimeout(() => (this.typed = ''), TYPEAHEAD_RESET_MS);
      const i = typeaheadIndex(
        this.options(),
        this.typed,
        this.open() ? this.active() : this.selectedIndex(),
      );
      if (i < 0) return;
      if (this.open()) this.active.set(i);
      else this.value.set(this.options()[i].value);
    }
  }
}
