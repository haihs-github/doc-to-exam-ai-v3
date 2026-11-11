// Created by Haihs on 11/11/2026
// appModalFocus directive: focus on open ([data-autofocus] or first focusable), Tab trap, Esc -> (dismissed), restore focus on close.
import { Directive, ElementRef, OnDestroy, afterNextRender, inject, output } from '@angular/core';

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

// Shared across dialogs so a queued dialog replacing another still restores to the ORIGINAL opener.
let openCount = 0;
let opener: HTMLElement | null = null;

@Directive({
  selector: '[appModalFocus]',
  host: { '(document:keydown)': 'onKey($event)' },
})
export class ModalFocus implements OnDestroy {
  readonly dismissed = output<void>();
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  constructor() {
    if (openCount++ === 0) opener = document.activeElement as HTMLElement | null;
    afterNextRender(() =>
      (this.el.querySelector<HTMLElement>('[data-autofocus]') ?? this.items()[0])?.focus(),
    );
  }

  ngOnDestroy(): void {
    if (--openCount === 0) {
      if (opener?.isConnected) opener.focus();
      opener = null;
    }
  }

  protected onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') return this.dismissed.emit();
    if (e.key !== 'Tab') return;
    const items = this.items();
    if (!items.length) return e.preventDefault();
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    const outside = !this.el.contains(active);
    if (e.shiftKey ? outside || active === first : outside || active === last) {
      e.preventDefault();
      (e.shiftKey ? last : first).focus();
    }
  }

  private items(): HTMLElement[] {
    return [...this.el.querySelectorAll<HTMLElement>(FOCUSABLE)];
  }
}
