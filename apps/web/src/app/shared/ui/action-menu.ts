// Created by Haihs on 12/11/2026
// <app-action-menu>: 3-dot button opening a fixed-position role=menu (port of ActionMenu.jsx, plus arrow/Home/End keys).
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  inject,
  input,
  signal,
  Injector,
} from '@angular/core';
import { RouterLink } from '@angular/router';

export interface ActionMenuItem {
  label: string;
  onClick?: () => void;
  /** Router link instead of a button. */
  to?: string;
  danger?: boolean;
  disabled?: boolean;
}

const ITEM =
  'flex min-h-[48px] w-full cursor-pointer items-center gap-2.5 px-4 text-left text-base font-medium hover:bg-gray-100 disabled:opacity-50 dark:hover:bg-gray-700';

@Component({
  selector: 'app-action-menu',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      #trigger
      type="button"
      (click)="toggle(trigger)"
      [attr.aria-label]="label()"
      aria-haspopup="menu"
      [attr.aria-expanded]="pos() !== null"
      class="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded border border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
    >
      <svg class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <circle cx="12" cy="5" r="2" />
        <circle cx="12" cy="12" r="2" />
        <circle cx="12" cy="19" r="2" />
      </svg>
    </button>
    @if (pos(); as p) {
      <div
        role="menu"
        [style.top.px]="p.top"
        [style.right.px]="p.right"
        class="fixed z-50 min-w-[220px] overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-overlay dark:border-gray-700 dark:bg-gray-800 dark:shadow-overlay-dark"
      >
        @for (it of items(); track it.label) {
          @if (it.to) {
            <a
              role="menuitem"
              [routerLink]="it.to"
              [class]="cls(it)"
              (click)="close(); focusTrigger()"
              >{{ it.label }}</a
            >
          } @else {
            <button
              type="button"
              role="menuitem"
              [disabled]="it.disabled"
              [class]="cls(it)"
              (click)="run(it)"
            >
              {{ it.label }}
            </button>
          }
        }
      </div>
    }
  `,
  host: {
    '(document:keydown)': 'onKey($event)',
    '(document:pointerdown)': 'onDown($event)',
    // Haihs: scroll chỉ đóng menu khi trang thực sự cuộn sau lúc mở - start
    // đóng code cũ
    // '(window:scroll)': 'close()',
    '(window:scroll)': 'onScroll()',
    // Haihs: scroll chỉ đóng menu khi trang thực sự cuộn sau lúc mở - end
    '(window:resize)': 'close()',
  },
})
export class ActionMenu {
  readonly items = input.required<ActionMenuItem[]>();
  readonly label = input('Thao tác');
  protected readonly pos = signal<{ top: number; right: number } | null>(null);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly injector = inject(Injector);

  protected cls(it: ActionMenuItem): string {
    return `${ITEM} ${it.danger ? 'text-red-600 dark:text-red-400' : 'text-gray-800 dark:text-gray-100'}`;
  }

  private enabled(): HTMLElement[] {
    return [...this.host.querySelectorAll<HTMLElement>('[role="menuitem"]')].filter(
      (e) => !(e as HTMLButtonElement).disabled,
    );
  }

  protected toggle(btn: HTMLElement): void {
    if (this.pos()) return this.close();
    // Haihs: scroll chỉ đóng menu khi trang thực sự cuộn sau lúc mở - start
    this.openScrollY = window.scrollY;
    // Haihs: scroll chỉ đóng menu khi trang thực sự cuộn sau lúc mở - end
    const r = btn.getBoundingClientRect();
    this.pos.set({ top: r.bottom + 4, right: window.innerWidth - r.right });
    // Haihs: menu thao tác mở lên trên khi sát đáy cửa sổ và focus không cuộn trang - start
    // đóng code cũ
    // afterNextRender(() => this.enabled()[0]?.focus(), { injector: this.injector });
    afterNextRender(
      () => {
        // Near the bottom of the window the menu would fall outside the viewport (it is position: fixed): open it upwards.
        const menu = this.host.querySelector<HTMLElement>('[role="menu"]');
        const h = menu?.offsetHeight ?? 0;
        if (h && r.bottom + 4 + h > window.innerHeight - 8)
          this.pos.set({ top: Math.max(8, r.top - 4 - h), right: window.innerWidth - r.right });
        this.enabled()[0]?.focus({ preventScroll: true }); // focus must not scroll: a scroll closes the menu
      },
      { injector: this.injector },
    );
    // Haihs: menu thao tác mở lên trên khi sát đáy cửa sổ và focus không cuộn trang - end
  }

  protected focusTrigger(): void {
    this.host.querySelector<HTMLElement>('button[aria-haspopup]')!.focus();
    // Haihs: scroll chỉ đóng menu khi trang thực sự cuộn sau lúc mở - start
  }

  private openScrollY = 0;
  /** A scroll event queued from before the menu opened must not close it: only a real scroll since opening does. */
  protected onScroll(): void {
    if (Math.abs(window.scrollY - this.openScrollY) > 2) this.close();
    // Haihs: scroll chỉ đóng menu khi trang thực sự cuộn sau lúc mở - end
  }

  protected close(): void {
    this.pos.set(null);
  }

  protected run(it: ActionMenuItem): void {
    this.close();
    this.focusTrigger();
    it.onClick?.();
  }

  protected onKey(e: KeyboardEvent): void {
    if (!this.pos()) return;
    if (e.key === 'Escape') {
      this.close();
      this.focusTrigger();
    } else if (e.key === 'Tab') {
      this.close();
    } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
      e.preventDefault();
      const list = this.enabled();
      if (!list.length) return;
      const cur = list.indexOf(document.activeElement as HTMLElement);
      const i =
        e.key === 'Home'
          ? 0
          : e.key === 'End'
            ? list.length - 1
            : (cur + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length;
      list[i].focus();
    }
  }

  protected onDown(e: Event): void {
    if (this.pos() && !this.host.contains(e.target as Node)) this.close();
  }
}
