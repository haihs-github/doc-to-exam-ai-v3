// Created by Haihs on 12/11/2026
// <app-sitting-submission-modal>: one submission - essay answers (text or the original photo/PDF), manual grading per essay (optimistic lock) and the violation log. Port of SittingSubmissionModal.jsx.
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import type { QuestionDto } from '@doc-to-exam/contract';
import { firstValueFrom } from 'rxjs';
import { SittingsApi, SubmissionRow } from '../../core/sittings.api';
import { formatTimeSecondsDate } from '../utils/date-format';
import { describeSittingError } from '../utils/sitting-ui';
import { AlertService } from './alert.service';
import { FormattedText } from './formatted-text';
import { ModalFocus } from './modal-focus';
import { Icon } from './icon';

interface Draft {
  scores: Record<string, string>;
  comments: Record<string, string>;
  feedback: string;
}

@Component({
  selector: 'app-sitting-submission-modal',
  // Haihs: icon cho nút giống bản gốc - start
  // đóng code cũ
  // imports: [FormattedText, ModalFocus],
  imports: [FormattedText, ModalFocus, Icon],
  // Haihs: icon cho nút giống bản gốc - end
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
      <div
        appModalFocus
        (dismissed)="closed.emit()"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sub-title"
        class="my-6 w-full max-w-3xl space-y-5 rounded-lg border border-gray-200 bg-white p-6 shadow-overlay dark:border-gray-700 dark:bg-gray-800 dark:shadow-overlay-dark"
      >
        <header class="flex items-start justify-between gap-3">
          <div>
            <h2 id="sub-title" class="text-lg font-bold">{{ s().studentName || 'Học sinh' }}</h2>
            <p class="text-base text-gray-600 dark:text-gray-400">
              Nộp lúc {{ fmt(s().submittedAt) }}{{ s().isAutoSubmitted ? ' (tự động nộp)' : '' }} ·
              Điểm {{ s().totalScore ?? '—' }}/{{ s().maxScore }}
            </p>
          </div>
          <button type="button" class="btn-secondary" (click)="closed.emit()">Đóng</button>
        </header>

        @for (q of essayQuestions(); track q.id) {
          @let a = answerOf(q.id);
          <section
            class="space-y-3 rounded-xl border border-gray-200 p-4 dark:border-gray-700"
            [attr.aria-label]="'Câu tự luận ' + q.id"
          >
            <h3 class="font-bold">Câu {{ numberOf(q.id) }} (tối đa {{ q.maxScore }} điểm)</h3>
            <p class="text-base"><app-formatted-text [text]="q.questionText" /></p>
            @if (a?.source === 'file-media') {
              <div class="flex flex-wrap items-center gap-2">
                <span class="text-base">Tệp: {{ a?.fileName }}</span>
                <button
                  type="button"
                  class="btn-secondary"
                  [disabled]="mediaBusy()"
                  (click)="openMedia(q.id)"
                >
                  Xem tệp gốc
                </button>
              </div>
            } @else {
              <pre
                class="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-base dark:bg-gray-900"
                >{{ a?.text || '(Học sinh chưa làm câu này)' }}</pre>
            }
            <div class="space-y-2">
              @for (c of q.rubric ?? []; track c.key) {
                <div class="flex flex-wrap items-center gap-2">
                  <span class="min-w-[10rem] flex-1 text-base"
                    >{{ c.label }} (tối đa {{ c.max }})</span
                  >
                  <input
                    type="text"
                    inputmode="decimal"
                    class="input w-24"
                    [value]="draft(q.id).scores[c.key] ?? ''"
                    (input)="setScore(q.id, c.key, $event)"
                    [attr.aria-label]="'Điểm ' + c.label"
                  />
                  <input
                    type="text"
                    class="input w-56"
                    placeholder="Nhận xét"
                    maxlength="400"
                    [value]="draft(q.id).comments[c.key] ?? ''"
                    (input)="setComment(q.id, c.key, $event)"
                    [attr.aria-label]="'Nhận xét ' + c.label"
                  />
                </div>
              }
              <textarea
                class="input min-h-[64px] w-full"
                placeholder="Nhận xét chung"
                maxlength="1500"
                [value]="draft(q.id).feedback"
                (input)="setFeedback(q.id, $event)"
                [attr.aria-label]="'Nhận xét chung câu ' + q.id"
              ></textarea>
              @if (errors()[q.id]) {
                <p role="alert" class="text-sm font-medium text-red-700 dark:text-red-300">
                  {{ errors()[q.id] }}
                </p>
              }
              <button type="button" class="btn-primary" [disabled]="saving()" (click)="save(q)">
                Lưu điểm câu này
              </button>
            </div>
          </section>
        }

        <section aria-label="Log vi phạm">
          <h3 class="font-bold">Vi phạm ({{ violations().length }})</h3>
          @if (violations().length === 0) {
            <p class="text-base text-gray-600 dark:text-gray-400">Không có vi phạm.</p>
          }
          <ul class="space-y-1">
            @for (v of violations(); track $index) {
              <li class="flex items-center justify-between gap-3 text-base">
                <span>{{ fmt(v.at) }} — {{ v.reason }}</span>
                <button
                  type="button"
                  class="btn-secondary"
                  [disabled]="saving()"
                  (click)="removeViolation($index, v.at)"
                  [attr.aria-label]="'Xóa vi phạm ' + ($index + 1)"
                >
                  <!-- Haihs: icon cho nút giống bản gốc - start -->
                  <!-- đóng code cũ -->
                  <!-- Xóa -->
                  <app-icon name="trash-2" svgClass="h-4 w-4" /> Xóa
                  <!-- Haihs: icon cho nút giống bản gốc - end -->
                </button>
              </li>
            }
          </ul>
        </section>
      </div>
    </div>
  `,
})
export class SittingSubmissionModal implements OnDestroy {
  readonly sittingId = input.required<string>();
  readonly s = input.required<SubmissionRow>();
  readonly questions = input.required<QuestionDto[]>();
  readonly closed = output<void>();
  readonly changed = output<void>();
  private readonly api = inject(SittingsApi);
  private readonly alert = inject(AlertService);
  protected readonly fmt = formatTimeSecondsDate;
  protected readonly saving = signal(false);
  protected readonly mediaBusy = signal(false);
  protected readonly errors = signal<Record<number, string>>({});
  protected readonly drafts = signal<Record<number, Draft>>({});
  protected readonly violations = signal<{ at: string; reason: string }[]>([]);
  protected readonly essayQuestions = computed(() =>
    this.questions().filter((q) => q.type === 'essay'),
  );
  private urls: string[] = [];

  constructor() {
    queueMicrotask(() => {
      this.violations.set(this.s().tabViolations ?? []);
      const next: Record<number, Draft> = {};
      for (const q of this.essayQuestions()) {
        const r = this.s().essayResults?.find((x) => x.questionId === q.id);
        next[q.id] = {
          scores: Object.fromEntries(
            (q.rubric ?? []).map((c) => [
              c.key,
              String(r?.criteria.find((x) => x.key === c.key)?.score ?? 0),
            ]),
          ),
          comments: Object.fromEntries(
            (q.rubric ?? []).map((c) => [
              c.key,
              r?.criteria.find((x) => x.key === c.key)?.comment ?? '',
            ]),
          ),
          feedback: r?.feedback ?? '',
        };
      }
      this.drafts.set(next);
    });
  }
  ngOnDestroy(): void {
    this.urls.forEach((u) => URL.revokeObjectURL(u));
  }

  protected draft(id: number): Draft {
    return this.drafts()[id] ?? { scores: {}, comments: {}, feedback: '' };
  }
  protected numberOf(id: number): number {
    return this.questions().findIndex((q) => q.id === id) + 1;
  }
  protected answerOf(id: number) {
    return this.s().essayAnswers?.find((a) => a.questionId === id);
  }
  private patch(id: number, fn: (d: Draft) => Draft): void {
    this.drafts.update((all) => ({
      ...all,
      [id]: fn(all[id] ?? { scores: {}, comments: {}, feedback: '' }),
    }));
  }
  protected setScore(id: number, key: string, e: Event): void {
    const v = (e.target as HTMLInputElement).value.replace(',', '.');
    this.patch(id, (d) => ({ ...d, scores: { ...d.scores, [key]: v } }));
  }
  protected setComment(id: number, key: string, e: Event): void {
    const v = (e.target as HTMLInputElement).value;
    this.patch(id, (d) => ({ ...d, comments: { ...d.comments, [key]: v } }));
  }
  protected setFeedback(id: number, e: Event): void {
    const v = (e.target as HTMLTextAreaElement).value;
    this.patch(id, (d) => ({ ...d, feedback: v }));
  }

  /** The original file goes through an authenticated blob request (a plain link would carry no Bearer token). */
  protected async openMedia(questionId: number): Promise<void> {
    this.mediaBusy.set(true);
    try {
      const blob = await firstValueFrom(
        this.api.essayMedia(this.sittingId(), this.s()._id, questionId),
      );
      const url = URL.createObjectURL(blob);
      this.urls.push(url);
      window.open(url, '_blank', 'noopener');
    } catch {
      void this.alert.error('Tệp gốc đã quá thời hạn lưu hoặc không còn tồn tại.');
    } finally {
      this.mediaBusy.set(false);
    }
  }

  protected async save(q: QuestionDto): Promise<void> {
    if (this.saving()) return; // single-flight
    const d = this.draft(q.id);
    const criteria: { key: string; score: number; comment: string }[] = [];
    for (const c of q.rubric ?? []) {
      const n = Number(d.scores[c.key]);
      if (
        !Number.isFinite(n) ||
        n < 0 ||
        n > c.max ||
        Math.abs(n / 0.25 - Math.round(n / 0.25)) > 1e-9
      ) {
        this.errors.update((m) => ({
          ...m,
          [q.id]: `Điểm "${c.label}" phải là bội số của 0,25 từ 0 đến ${c.max}.`,
        }));
        return;
      }
      criteria.push({ key: c.key, score: n, comment: d.comments[c.key] ?? '' });
    }
    this.errors.update((m) => ({ ...m, [q.id]: '' }));
    const existing = this.s().essayResults?.find((x) => x.questionId === q.id);
    this.saving.set(true);
    try {
      await firstValueFrom(
        this.api.gradeEssay(this.sittingId(), this.s()._id, q.id, {
          criteria,
          feedback: d.feedback,
          baseGradedAt: existing?.gradedAt ?? null,
        }),
      );
      void this.alert.success('Đã lưu điểm.');
      this.changed.emit();
    } catch (e) {
      const code = (e as { code?: string }).code;
      void this.alert.error(
        code === 'GRADE_CONFLICT'
          ? 'Bài vừa được sửa ở nơi khác, hãy đóng và mở lại bài này trước khi lưu.'
          : describeSittingError(e, 'Không lưu được điểm.'),
      );
      if (code === 'GRADE_CONFLICT') this.changed.emit();
    } finally {
      this.saving.set(false);
    }
  }

  protected async removeViolation(index: number, at: string): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    try {
      const r = await firstValueFrom(
        this.api.deleteViolation(this.sittingId(), this.s()._id, index, at),
      );
      this.violations.set(r.tabViolations);
      this.changed.emit();
    } catch (e) {
      void this.alert.error(describeSittingError(e, 'Không xóa được log vi phạm.'));
    } finally {
      this.saving.set(false);
    }
  }
}
