// Created by Haihs on 12/11/2026
// <app-class-restore-code-modal>: asks for a new code when restoring a class whose code was taken (409 CLASS_CODE_TAKEN).
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import type { ClassDto } from '@doc-to-exam/contract';
import { finalize } from 'rxjs';
import { ClassesApi } from '../../core/classes.api';
import { focusField } from '../../pages/form-helpers';
import { describeClassError, isClassCodeTaken, validateRestoreCode } from '../utils/class-ui';
import { upperClassCode } from '../utils/class-form';
import { LIMITS } from '../utils/limits';
import { AlertService } from './alert.service';
import { FormField } from './form-field';
import { ModalFocus } from './modal-focus';
import { Icon } from './icon';

@Component({
  selector: 'app-class-restore-code-modal',
  // Haihs: icon cho nút giống bản gốc - start
  // đóng code cũ
  // imports: [FormField, ModalFocus],
  imports: [FormField, ModalFocus, Icon],
  // Haihs: icon cho nút giống bản gốc - end
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form
        appModalFocus
        (dismissed)="cancel()"
        (submit)="submit($event)"
        novalidate
        role="dialog"
        aria-modal="true"
        aria-labelledby="restore-class-title"
        class="w-full max-w-md space-y-3 rounded-lg border border-gray-200 bg-white p-6 shadow-overlay dark:border-gray-700 dark:bg-gray-800 dark:shadow-overlay-dark"
      >
        <h2 id="restore-class-title" class="text-lg font-bold text-gray-900 dark:text-gray-100">
          Đặt mã mới để khôi phục
        </h2>
        <p class="text-base text-gray-600 dark:text-gray-400">
          Mã "{{ cls().code }}" đã được lớp khác sử dụng. Nhập mã mới cho lớp "{{ cls().name }}".
        </p>
        <app-form-field label="Mã lớp mới" [required]="true" [error]="error()">
          <input
            class="input uppercase"
            name="code"
            [attr.maxlength]="max"
            [value]="value()"
            (input)="onInput($event)"
          />
        </app-form-field>
        <div class="flex gap-3 pt-1">
          <button type="button" class="btn-secondary flex-1" [disabled]="busy()" (click)="cancel()">
            Hủy
          </button>
          <!-- Haihs: icon cho nút giống bản gốc - start -->
          <!-- đóng code cũ -->
          <!-- <button type="submit" class="btn-primary flex-1" [disabled]="busy()">Khôi phục</button> -->
          <button type="submit" class="btn-primary flex-1" [disabled]="busy()">
            <app-icon name="rotate-ccw" svgClass="h-4 w-4" /> Khôi phục
          </button>
          <!-- Haihs: icon cho nút giống bản gốc - end -->
        </div>
      </form>
    </div>
  `,
})
export class ClassRestoreCodeModal {
  readonly cls = input.required<ClassDto>();
  readonly restored = output<void>();
  readonly cancelled = output<void>();
  protected readonly max = LIMITS.CLASS_CODE_MAX;
  private readonly api = inject(ClassesApi);
  private readonly alert = inject(AlertService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly value = signal('');
  protected readonly error = signal('');
  protected readonly busy = signal(false);

  protected onInput(e: Event): void {
    this.value.set(upperClassCode((e.target as HTMLInputElement).value));
    this.error.set('');
  }

  protected cancel(): void {
    if (!this.busy()) this.cancelled.emit();
  }

  protected submit(e: Event): void {
    e.preventDefault();
    if (this.busy()) return; // single-flight
    const checked = validateRestoreCode(this.value());
    if (!checked.ok) {
      this.error.set(checked.error);
      return focusField(this.host.nativeElement, 'code');
    }
    this.busy.set(true);
    this.error.set('');
    this.api
      .restore(this.cls().id, { code: checked.code })
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: () => {
          this.restored.emit();
          void this.alert.success('Đã khôi phục lớp.');
        },
        error: (err: unknown) => {
          if (isClassCodeTaken(err)) {
            this.error.set('Mã này cũng đã được lớp khác sử dụng, hãy nhập mã khác.');
            focusField(this.host.nativeElement, 'code');
          } else void this.alert.error(describeClassError(err, 'Không khôi phục được lớp.'));
        },
      });
  }
}
