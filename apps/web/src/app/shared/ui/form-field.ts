// Created by Haihs on 11/11/2026
// <app-form-field>: label + projected control + hint/error; wires for/id, aria-describedby, aria-invalid, aria-required.
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  inject,
  input,
} from '@angular/core';

let nextId = 0;
const CONTROL = 'input, select, textarea';

@Component({
  selector: 'app-form-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (label()) {
      <label
        [attr.for]="id"
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
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    // The projected control is found in the DOM (content projection exposes no handle to it).
    afterRenderEffect(() => {
      const describedBy =
        [this.error() && `${this.id}-err`, this.hint() && `${this.id}-hint`]
          .filter(Boolean)
          .join(' ') || null;
      const control = this.host.nativeElement.querySelector(CONTROL);
      if (!control) return;
      control.id = this.id;
      this.set(control, 'aria-describedby', describedBy);
      this.set(control, 'aria-invalid', this.error() ? 'true' : null);
      this.set(control, 'aria-required', this.required() ? 'true' : null);
    });
  }

  private set(el: Element, name: string, value: string | null): void {
    if (value === null) el.removeAttribute(name);
    else el.setAttribute(name, value);
  }
}
