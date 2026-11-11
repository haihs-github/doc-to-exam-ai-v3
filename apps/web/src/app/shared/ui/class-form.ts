// Created by Haihs on 12/11/2026
// <app-class-form>: modal to create (cls = null) or edit a class; port of ClassForm.jsx without the status field (see task-11 report).
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { isApiError } from '@doc-to-exam/contract';
import type { ClassBody, ClassDto } from '@doc-to-exam/contract';
import { finalize } from 'rxjs';
import { ClassesApi } from '../../core/classes.api';
import { focusField } from '../../pages/form-helpers';
import { describeClassError } from '../utils/class-ui';
import {
  CLASS_FORM_ORDER,
  ClassFormField,
  FormErrors,
  upperClassCode,
  validateClassForm,
} from '../utils/class-form';
import { LIMITS } from '../utils/limits';
import { AlertService } from './alert.service';
import { FormField } from './form-field';
import { ModalFocus } from './modal-focus';

@Component({
  selector: 'app-class-form',
  imports: [FormField, ModalFocus],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4"
    >
      <form
        appModalFocus
        (dismissed)="cancel()"
        (submit)="submit($event)"
        novalidate
        role="dialog"
        aria-modal="true"
        aria-labelledby="class-form-title"
        class="w-full max-w-xl space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-overlay dark:border-gray-700 dark:bg-gray-800 dark:shadow-overlay-dark"
      >
        <h2 id="class-form-title" class="text-xl font-bold text-gray-900 dark:text-gray-100">
          {{ cls() ? 'Sửa lớp' : 'Lớp mới' }}
        </h2>
        <div class="grid gap-3 sm:grid-cols-2">
          <app-form-field label="Tên lớp" [required]="true" [error]="errors()['name'] ?? ''">
            <input
              class="input uppercase"
              name="name"
              [attr.maxlength]="max.CLASS_NAME_MAX"
              [value]="v().name"
              (input)="set('name', $event)"
            />
          </app-form-field>
          <app-form-field
            label="Mã lớp (duy nhất toàn hệ thống)"
            [required]="true"
            [error]="errors()['code'] ?? ''"
          >
            <input
              class="input uppercase"
              name="code"
              [attr.maxlength]="max.CLASS_CODE_MAX"
              [value]="v().code"
              (input)="set('code', $event)"
            />
          </app-form-field>
          <app-form-field
            label="Năm bắt đầu"
            [required]="true"
            [error]="errors()['startYear'] ?? ''"
          >
            <input
              class="input"
              name="startYear"
              inputmode="numeric"
              placeholder="2023"
              [value]="v().startYear"
              (input)="set('startYear', $event)"
            />
          </app-form-field>
          <app-form-field
            label="Năm kết thúc"
            [required]="true"
            [error]="errors()['endYear'] ?? ''"
          >
            <input
              class="input"
              name="endYear"
              inputmode="numeric"
              placeholder="2026"
              [value]="v().endYear"
              (input)="set('endYear', $event)"
            />
          </app-form-field>
        </div>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn-secondary" [disabled]="busy()" (click)="cancel()">
            Hủy
          </button>
          <button type="submit" class="btn-primary" [disabled]="busy()">
            {{ busy() ? 'Đang lưu...' : cls() ? 'Lưu' : 'Tạo lớp' }}
          </button>
        </div>
      </form>
    </div>
  `,
})
export class ClassForm {
  readonly cls = input<ClassDto | null>(null);
  readonly saved = output<void>();
  readonly cancelled = output<void>();
  protected readonly max = LIMITS;
  private readonly api = inject(ClassesApi);
  private readonly alert = inject(AlertService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly v = linkedSignal(() => {
    const c = this.cls();
    return {
      name: c?.name ?? '',
      code: c?.code ?? '',
      startYear: c ? String(c.startYear) : '',
      endYear: c ? String(c.endYear) : '',
    };
  });
  protected readonly errors = signal<FormErrors>({});
  protected readonly busy = signal(false);

  protected set(field: ClassFormField, e: Event): void {
    const raw = (e.target as HTMLInputElement).value;
    const value = field === 'name' || field === 'code' ? upperClassCode(raw) : raw;
    this.v.update((cur) => ({ ...cur, [field]: value }));
    // live re-check keeps only errors already on screen (never adds new ones)
    const fresh = validateClassForm(this.v());
    this.errors.update((prev) =>
      Object.fromEntries(Object.entries(prev).filter(([k]) => fresh[k as ClassFormField])),
    );
  }

  protected cancel(): void {
    if (!this.busy()) this.cancelled.emit();
  }

  protected submit(e: Event): void {
    e.preventDefault();
    if (this.busy()) return; // single-flight
    const found = validateClassForm(this.v());
    this.errors.set(found);
    const first = CLASS_FORM_ORDER.find((k) => found[k]);
    if (first) return focusField(this.host.nativeElement, first);

    const v = this.v();
    const body: ClassBody = {
      name: upperClassCode(v.name).trim(),
      code: upperClassCode(v.code).trim(),
      startYear: Number(v.startYear),
      endYear: Number(v.endYear),
    };
    const editing = this.cls();
    this.busy.set(true);
    (editing ? this.api.update(editing.id, body) : this.api.create(body))
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: () => {
          this.saved.emit();
          void this.alert.success(editing ? 'Đã lưu lớp.' : 'Đã tạo lớp.');
        },
        error: (err: unknown) => {
          const msg = describeClassError(
            err,
            editing ? 'Không lưu được lớp.' : 'Không tạo được lớp.',
          );
          const field = isApiError(err) ? (err.field as ClassFormField | undefined) : undefined;
          if (field && CLASS_FORM_ORDER.includes(field)) {
            this.errors.set({ [field]: msg });
            focusField(this.host.nativeElement, field);
          } else void this.alert.error(msg);
        },
      });
  }
}
