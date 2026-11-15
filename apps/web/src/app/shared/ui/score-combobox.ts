// Created by Haihs on 15/11/2026
// <app-score-combobox>: score field you can type into (comma accepted) or pick from 0, 0,25 ... up to the cap. Port of ScoreCombobox.jsx; value is the dotted text the grading drafts keep.
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  input,
  model,
  signal,
} from '@angular/core';
import { Icon } from './icon';
import { nextActiveIndex } from './search-select';

const SCORE_STEP = 0.25;
const round = (n: number): number => Math.round(n * 100) / 100;

/** 0.25 -> "0,25"; 1 -> "1". */
export const commaScore = (value: number | string): string =>
  String(round(Number(value) || 0)).replace('.', ',');

/** 0, 0.25, ... up to the cap. */
export const scoreOptions = (max: number): number[] =>
  Array.from({ length: Math.floor(Number(max) / SCORE_STEP + 1e-9) + 1 }, (_, i) =>
    round(i * SCORE_STEP),
  );

/** Keeps the options whose comma form starts with the typed text; empty text keeps all. */
export const filterScoreOptions = (options: number[], text: string): number[] => {
  const typed = String(text ?? '')
    .trim()
    .replace('.', ',');
  return typed === '' ? options : options.filter((v) => commaScore(v).startsWith(typed));
};

let uid = 0;

@Component({
  selector: 'app-score-combobox',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'relative block' },
  template: `
    <input
      type="text"
      inputmode="decimal"
      role="combobox"
      autocomplete="off"
      [attr.aria-label]="label() || null"
      [attr.aria-expanded]="open()"
      [attr.aria-controls]="open() ? listId : null"
      aria-autocomplete="list"
      [attr.aria-activedescendant]="open() && active() >= 0 ? listId + '-opt-' + active() : null"
      [attr.aria-invalid]="invalid() || null"
      [disabled]="disabled()"
      [value]="shown()"
      (input)="onType($event)"
      (pointerdown)="!open() && show()"
      (keydown)="onKey($event)"
      class="input pr-9"
    />
    <button
      type="button"
      tabindex="-1"
      aria-label="Mở danh sách điểm"
      [disabled]="disabled()"
      (mousedown)="$event.preventDefault()"
      (click)="open() ? open.set(false) : show()"
      class="absolute inset-y-0 right-0 cursor-pointer px-3 text-gray-500 dark:text-gray-400"
    >
      <app-icon name="chevron-down" svgClass="h-5 w-5" />
    </button>
    @if (open() && options().length > 0) {
      <ul
        [id]="listId"
        role="listbox"
        class="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-overlay dark:border-gray-700 dark:bg-gray-800 dark:shadow-overlay-dark"
      >
        @for (v of options(); track v; let i = $index) {
          <li
            [id]="listId + '-opt-' + i"
            role="option"
            tabindex="-1"
            [attr.aria-selected]="isSelected(v)"
            (mousedown)="$event.preventDefault()"
            (click)="pick(v)"
            (keydown.enter)="pick(v)"
            (mouseenter)="active.set(i)"
            class="min-h-[40px] cursor-pointer px-3 py-2 text-base"
            [class]="
              (i === active() ? 'bg-primary-50 dark:bg-gray-700 ' : '') +
              (isSelected(v) ? 'font-semibold text-primary-900 dark:text-sky-400' : '')
            "
          >
            {{ comma(v) }}
          </li>
        }
      </ul>
    }
  `,
})
export class ScoreCombobox {
  /** Dotted score text ("1.5"); shown with a comma. */
  readonly value = model('');
  readonly max = input.required<number>();
  readonly label = input('');
  readonly disabled = input(false);
  readonly invalid = input(false);

  protected readonly listId = `app-score-combobox-${++uid}`;
  protected readonly open = signal(false);
  protected readonly active = signal(-1);
  private readonly dirty = signal(false); // only filter after typing; a fresh open lists everything
  protected readonly comma = commaScore;
  protected readonly shown = computed(() => this.value().replace('.', ','));
  private readonly all = computed(() => scoreOptions(this.max()));
  protected readonly options = computed(() =>
    this.dirty() ? filterScoreOptions(this.all(), this.value()) : this.all(),
  );
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    const onDown = (e: Event): void => {
      if (this.open() && !this.host.nativeElement.contains(e.target as Node)) this.open.set(false);
    };
    document.addEventListener('pointerdown', onDown);
    inject(DestroyRef).onDestroy(() => document.removeEventListener('pointerdown', onDown));
  }

  protected isSelected = (v: number): boolean =>
    commaScore(v) === this.value().replace('.', ',').trim();
  protected show(): void {
    this.dirty.set(false);
    this.active.set(-1);
    this.open.set(true);
  }
  protected pick(v: number): void {
    this.value.set(String(v));
    this.open.set(false);
  }
  protected onType(e: Event): void {
    this.value.set((e.target as HTMLInputElement).value.replace(',', '.'));
    this.dirty.set(true);
    this.active.set(-1);
    this.open.set(true);
  }
  protected onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      if (this.open()) {
        e.preventDefault();
        this.open.set(false);
      }
      return;
    }
    if (e.key === 'Tab') return void this.open.set(false);
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
      if ((e.key === 'Home' || e.key === 'End') && !this.open()) return; // let the caret move
      e.preventDefault();
      if (!this.open()) return this.show();
      this.active.set(nextActiveIndex(e.key, this.active(), this.options().length));
    } else if (e.key === 'Enter' && this.open()) {
      e.preventDefault(); // Enter confirms, never submits a parent form
      const v = this.options()[this.active()];
      if (v !== undefined) this.pick(v);
      else this.open.set(false);
    }
  }
}
