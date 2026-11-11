// Created by Haihs on 11/11/2026
// appModalFocus directive: modal stack (only the top layer handles keys), focus on open, Tab trap, Esc -> (dismissed), restore focus.
// TODO(web): M8 — khóa cuộn nền (overflow-hidden) và inert cho toàn bộ app khi có modal
import { Directive, ElementRef, OnDestroy, afterNextRender, inject, output } from '@angular/core';

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

// Open layers, oldest first. Shared by Alert and Confirm so they stack instead of fighting over Esc/Tab.
const stack: ModalFocus[] = [];
let opener: HTMLElement | null = null; // focus owner before the FIRST layer opened

@Directive({
  selector: '[appModalFocus]',
  host: { '(document:keydown)': 'onKey($event)' },
})
export class ModalFocus implements OnDestroy {
  readonly dismissed = output<void>();
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly depth: number;

  constructor() {
    if (stack.length === 0) opener = document.activeElement as HTMLElement | null;
    stack.at(-1)?.layer()?.setAttribute('inert', ''); // layer below is frozen while this one is open
    stack.push(this);
    this.depth = stack.length;
    afterNextRender(() => {
      const layer = this.layer();
      if (layer) layer.style.zIndex = String(50 + this.depth);
      this.focusFirst();
    });
  }

  ngOnDestroy(): void {
    const i = stack.indexOf(this);
    if (i >= 0) stack.splice(i, 1);
    const top = stack.at(-1);
    if (top) {
      top.layer()?.removeAttribute('inert');
      top.focusFirst();
    } else {
      this.restoreFocus();
    }
  }

  protected onKey(e: KeyboardEvent): void {
    if (stack.at(-1) !== this) return;
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

  private layer(): HTMLElement | null {
    return this.el.parentElement; // the backdrop wrapper
  }

  private focusFirst(): void {
    (this.el.querySelector<HTMLElement>('[data-autofocus]') ?? this.items()[0])?.focus();
  }

  private items(): HTMLElement[] {
    return [...this.el.querySelectorAll<HTMLElement>(FOCUSABLE)];
  }

  private restoreFocus(): void {
    const target = opener?.isConnected ? opener : (document.querySelector('main') ?? document.body);
    opener = null;
    // Opener gone (e.g. the page navigated): park focus on a stable landmark instead of losing it.
    if (!target.isConnected || target.matches(FOCUSABLE) || target.hasAttribute('tabindex'))
      target.focus();
    else {
      target.setAttribute('tabindex', '-1');
      target.focus();
    }
  }
}
