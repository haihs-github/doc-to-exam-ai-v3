// Created by Haihs on 15/11/2026
// <app-sitting-schedule-panel>: open/close time and duration of a sitting, editable in place; asks first when shortening hits students who are taking the exam. Port of SittingSchedulePanel.jsx.
import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import type { SittingDetail } from '@doc-to-exam/contract';
import { finalize } from 'rxjs';
import { SittingsApi } from '../../core/sittings.api';
import { formatDateTime } from '../utils/date-format';
import { validateSittingForm } from '../utils/sitting-form';
import { describeSittingError } from '../utils/sitting-ui';
import { parseVnDateTime } from '../utils/vn-datetime';
import { AlertService } from './alert.service';
import { ConfirmService } from './confirm-modal';
import { DatetimeField } from './datetime-field';
import { FormField } from './form-field';
import { Icon } from './icon';

/** Warning text when the new close time / duration is shorter and students are working; '' when no confirmation is needed. */
export const shortenWarning = (
  before: { closeAt: string; durationMinutes: number },
  after: { closeAt: Date; durationMinutes: number },
  activeSessionCount: number,
): string => {
  const shortened =
    after.closeAt.getTime() < new Date(before.closeAt).getTime() ||
    after.durationMinutes < before.durationMinutes;
  return shortened && activeSessionCount > 0
    ? `Hiện có ${activeSessionCount} học sinh đang làm bài. Rút ngắn giờ đóng hoặc thời lượng sẽ làm hạn nộp của các bạn đó đến sớm hơn.`
    : '';
};

@Component({
  selector: 'app-sitting-schedule-panel',
  imports: [DatetimeField, FormField, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section
      class="space-y-3 rounded-xl border border-gray-200 bg-white p-5 shadow-raised dark:border-gray-700 dark:bg-gray-800 dark:shadow-raised-dark"
      aria-label="Giờ và thời lượng"
    >
      <div class="flex items-center justify-between">
        <h2 class="font-bold text-gray-900 dark:text-gray-100">Giờ và thời lượng</h2>
        @if (!editing()) {
          <button
            type="button"
            (click)="open()"
            class="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-base font-semibold text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            <app-icon name="pencil" svgClass="h-4 w-4" /> Sửa giờ
          </button>
        }
      </div>
      @if (!editing()) {
        <dl class="grid grid-cols-1 gap-3 text-base sm:grid-cols-3">
          <div>
            <dt class="text-sm text-gray-500 dark:text-gray-400">Giờ mở</dt>
            <dd class="font-semibold">{{ fmt(sitting().openAt) }}</dd>
          </div>
          <div>
            <dt class="text-sm text-gray-500 dark:text-gray-400">Giờ đóng</dt>
            <dd class="font-semibold">{{ fmt(sitting().closeAt) }}</dd>
          </div>
          <div>
            <dt class="text-sm text-gray-500 dark:text-gray-400">Thời lượng</dt>
            <dd class="font-semibold">{{ sitting().durationMinutes }} phút</dd>
          </div>
        </dl>
      } @else {
        <div class="space-y-3">
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <app-form-field label="Giờ mở" [required]="true" [error]="errors()['openAt'] ?? ''">
              <app-datetime-field name="openAt" [(value)]="openAt" />
            </app-form-field>
            <app-form-field label="Giờ đóng" [required]="true" [error]="errors()['closeAt'] ?? ''">
              <app-datetime-field name="closeAt" [(value)]="closeAt" />
            </app-form-field>
            <app-form-field
              label="Thời lượng (phút)"
              [required]="true"
              [error]="errors()['duration'] ?? ''"
            >
              <input
                class="input"
                name="duration"
                type="number"
                min="1"
                step="1"
                [value]="duration()"
                (input)="duration.set($any($event.target).value)"
              />
            </app-form-field>
          </div>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            Muốn kết thúc ca sớm, hãy đặt giờ đóng về hiện tại. Giờ đóng có thể ở quá khứ khi sửa.
          </p>
          <div class="flex gap-2">
            <button
              type="button"
              (click)="submit()"
              [disabled]="busy()"
              class="min-h-[48px] rounded-xl bg-primary-700 px-4 py-2 text-base font-semibold text-white hover:bg-primary-800 disabled:opacity-50 dark:bg-sky-400 dark:text-gray-900 dark:hover:bg-sky-300"
            >
              Lưu
            </button>
            <button
              type="button"
              (click)="editing.set(false)"
              [disabled]="busy()"
              class="min-h-[48px] rounded-xl border border-gray-300 px-4 py-2 text-base font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              Hủy
            </button>
          </div>
        </div>
      }
    </section>
  `,
})
export class SittingSchedulePanel {
  readonly sitting = input.required<SittingDetail>();
  readonly changed = output<void>();
  private readonly api = inject(SittingsApi);
  private readonly alert = inject(AlertService);
  private readonly confirm = inject(ConfirmService);
  protected readonly fmt = formatDateTime;
  protected readonly editing = signal(false);
  protected readonly busy = signal(false);
  protected readonly errors = signal<Record<string, string>>({});
  protected readonly openAt = signal('');
  protected readonly closeAt = signal('');
  protected readonly duration = signal('');

  protected open(): void {
    const s = this.sitting();
    this.openAt.set(formatDateTime(s.openAt));
    this.closeAt.set(formatDateTime(s.closeAt));
    this.duration.set(String(s.durationMinutes));
    this.errors.set({});
    this.editing.set(true);
  }

  protected async submit(): Promise<void> {
    if (this.busy()) return;
    const s = this.sitting();
    const errs = validateSittingForm({
      title: s.title,
      description: s.description ?? '',
      openAt: this.openAt(),
      closeAt: this.closeAt(),
      duration: this.duration(),
      classIds: s.classIds.length ? s.classIds : ['-'],
    });
    delete errs['title'];
    delete errs['description'];
    this.errors.set(errs);
    if (Object.keys(errs).length > 0) return;
    const open = parseVnDateTime(this.openAt()) as Date;
    const close = parseVnDateTime(this.closeAt()) as Date;
    const minutes = Number(this.duration());
    const warning = shortenWarning(
      s,
      { closeAt: close, durationMinutes: minutes },
      s.activeSessionCount,
    );
    if (warning) {
      const ok = await this.confirm.confirm(warning, {
        title: 'Rút ngắn giờ làm bài?',
        confirmText: 'Vẫn lưu',
        cancelText: 'Hủy',
      });
      if (!ok) return;
    }
    const body: { openAt?: string; closeAt?: string; durationMinutes?: number } = {};
    if (open.toISOString() !== new Date(s.openAt).toISOString()) body.openAt = open.toISOString();
    if (close.toISOString() !== new Date(s.closeAt).toISOString())
      body.closeAt = close.toISOString();
    if (minutes !== s.durationMinutes) body.durationMinutes = minutes;
    if (Object.keys(body).length === 0) {
      this.editing.set(false);
      void this.alert.warning('Không có thay đổi nào.');
      return;
    }
    this.busy.set(true);
    this.api
      .update(s.id, body)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: (d) => {
          const n = d.affectedSessions ?? 0;
          this.editing.set(false);
          this.changed.emit();
          void this.alert.success(
            n > 0
              ? `Đã lưu. ${n} phiên đang làm bài bị rút ngắn hạn nộp.`
              : 'Đã lưu giờ và thời lượng.',
          );
        },
        error: (e: unknown) => {
          const msg = describeSittingError(e, 'Không lưu được giờ và thời lượng.');
          const overlap = (e as { code?: string }).code === 'SITTING_OVERLAP';
          void this.alert.error(msg, overlap ? { title: 'Ca thi trùng giờ' } : undefined);
        },
      });
  }
}
