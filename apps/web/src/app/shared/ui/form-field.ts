// Created by Haihs on 11/11/2026
// <app-form-field>: label + projected control + hint/error; wires for/id, aria-describedby, aria-invalid, aria-required.
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterEveryRender,
  inject,
  input,
  signal,
} from '@angular/core';

let nextId = 0;
const CONTROL = 'input, select, textarea';

@Component({
  selector: 'app-form-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (label()) {
      <label
        [attr.for]="controlId()"
        class="mb-1.5 block text-base font-medium text-gray-800 dark:text-gray-200"
      >
        {{ label() }}
        @if (required()) {
          <span class="text-red-700 dark:text-red-300" aria-hidden="true"> *</span>
        }
      </label>
    }
    <ng-content />
    @if (hint()) {
      <p [id]="id + '-hint'" class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ hint() }}</p>
    }
    @if (error()) {
      <p
        [id]="id + '-err'"
        role="alert"
        class="mt-1 text-sm font-medium text-red-700 dark:text-red-300"
      >
        {{ error() }}
      </p>
    }
  `,
  host: { class: 'block' },
})
export class FormField {
  readonly label = input('');
  readonly error = input('');
  readonly hint = input('');
  readonly required = input(false);
  protected readonly id = `ff-${nextId++}`;
  protected readonly controlId = signal(this.id);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    // Runs after every render so a control that appears later (@if, nested component) is wired too.
    // Content projection exposes no handle to it, hence the DOM query. Every write is idempotent.
    afterEveryRender(() => {
      const control = this.host.nativeElement.querySelector(CONTROL);
      if (!control) return;
      if (!control.id) control.id = this.id; // an id set by the author wins
      if (this.controlId() !== control.id) this.controlId.set(control.id);
      const mine = [`${this.id}-err`, `${this.id}-hint`];
      const ids = [this.error() && mine[0], this.hint() && mine[1]].filter(Boolean) as string[];
      // Merge into the author's list instead of replacing it.
      const others = (control.getAttribute('aria-describedby') ?? '')
        .split(/\s+/)
        .filter((t) => t && !mine.includes(t));
      this.set(control, 'aria-describedby', [...others, ...ids].join(' ') || null);
      this.set(control, 'aria-invalid', this.error() ? 'true' : null);
      this.set(control, 'aria-required', this.required() ? 'true' : null);
    });
  }

  private set(el: Element, name: string, value: string | null): void {
    if (el.getAttribute(name) === value) return;
    if (value === null) el.removeAttribute(name);
    else el.setAttribute(name, value);
  }
}
