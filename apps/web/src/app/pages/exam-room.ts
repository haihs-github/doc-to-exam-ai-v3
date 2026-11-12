// Created by Haihs on 12/11/2026
// <app-exam-room> at /ca/:code/room: timer from the server deadline, answers draft, anti-cheat log, retrying submit, auto-submit at time up. Port of ExamRoom.jsx (typed essay only; uploads arrive with M6).
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { SubmitBody, StartedExam, StudentQuestion, TabViolation } from '@doc-to-exam/contract';
import { firstValueFrom } from 'rxjs';
import { ExamTakingApi } from '../core/exam-taking.api';
import { AlertService } from '../shared/ui/alert.service';
import { ConfirmService } from '../shared/ui/confirm-modal';
import { FormattedText } from '../shared/ui/formatted-text';
import { Skeleton } from '../shared/ui/skeleton';
import { decideAntiCheatAction, type AntiCheatAction } from '../shared/utils/anti-cheat-rules';
import {
  TakeError,
  arrangeQuestions,
  classifySubmitFailure,
  describeTakeError,
  formatQuestionPoints,
  normalizeCodeInput,
} from '../shared/utils/student-sitting';
import { submissionResultKey } from './exam-success';

const RESYNC_MS = 60_000;
const VIOLATION_DEBOUNCE_MS = 1500;
const SUBMIT_ATTEMPTS = 3;
const MAX_ESSAY_CHARS = 15000;
const store = {
  get: (k: string): string | null => {
    try {
      return sessionStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string): void => {
    try {
      sessionStorage.setItem(k, v);
    } catch {
      /* private mode: the draft is just not kept */
    }
  },
  del: (k: string): void => {
    try {
      sessionStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  },
};
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const pad = (n: number) => String(n).padStart(2, '0');

@Component({
  selector: 'app-exam-room',
  imports: [RouterLink, FormattedText, Skeleton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-5xl space-y-4 px-3 py-4" data-allow-busy>
      @if (loading()) {
        <app-skeleton variant="list" />
      } @else if (error(); as e) {
        <div role="alert" class="space-y-3">
          <h1 class="text-xl font-bold">
            {{
              e.kind === 'not_granted' ? 'Bạn chưa được vào ca thi này' : 'Không vào được phòng thi'
            }}
          </h1>
          <p class="text-base">{{ e.message }}</p>
          <a routerLink="/sittings" class="btn-secondary inline-flex">Về danh sách ca thi</a>
        </div>
      } @else if (exam(); as ex) {
        <header
          class="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800"
        >
          <h1 class="min-w-0 break-words text-lg font-bold">{{ ex.title }}</h1>
          <div class="flex items-center gap-3">
            <span
              class="font-mono text-xl font-extrabold"
              [class.text-red-700]="remaining() <= 60"
              role="timer"
              [attr.aria-label]="'Thời gian còn lại ' + clock()"
              >{{ clock() }}</span
            >
            <button
              type="button"
              class="btn-primary"
              [disabled]="submitting()"
              (click)="submit(false)"
            >
              {{ submitting() ? 'Đang nộp...' : 'Nộp bài' }}
            </button>
          </div>
        </header>
        <div class="grid gap-4 md:grid-cols-[1fr_14rem]">
          <section class="space-y-4" aria-label="Câu hỏi">
            @for (q of questions(); track q.id; let i = $index) {
              @if (showContext(i)) {
                <div class="rounded-lg bg-gray-50 p-3 text-base dark:bg-gray-900">
                  <app-formatted-text [text]="q.context" />
                </div>
              }
              <article
                [id]="'q-' + q.id"
                class="space-y-2 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
                [attr.aria-label]="'Câu ' + (i + 1)"
              >
                <h2 class="font-bold">
                  Câu {{ i + 1 }}
                  <span class="font-normal text-gray-600 dark:text-gray-400">{{ points(q) }}</span>
                </h2>
                <p class="text-base"><app-formatted-text [text]="q.questionText" /></p>
                @if (q.type === 'essay') {
                  @if (q.requirements) {
                    <p class="text-sm text-gray-600 dark:text-gray-400">
                      <app-formatted-text [text]="q.requirements" />
                    </p>
                  }
                  <textarea
                    data-essay-input
                    class="input min-h-[160px] w-full"
                    [attr.maxlength]="maxEssay"
                    [attr.aria-label]="'Bài làm câu ' + (i + 1)"
                    [value]="essay()[q.id] ?? ''"
                    (input)="setEssay(q.id, $any($event.target).value)"
                  ></textarea>
                } @else {
                  <div
                    role="radiogroup"
                    class="space-y-1"
                    [attr.aria-label]="'Đáp án câu ' + (i + 1)"
                  >
                    @for (k of keys; track k) {
                      @if (q.options?.[k]) {
                        <label
                          class="flex cursor-pointer items-start gap-2 rounded-lg p-2 hover:bg-gray-50 dark:hover:bg-gray-700"
                        >
                          <input
                            type="radio"
                            [name]="'a-' + q.id"
                            [checked]="answers()[q.id] === k"
                            (change)="setAnswer(q.id, k)"
                          />
                          <span class="font-bold">{{ k }}.</span>
                          <span><app-formatted-text [text]="q.options?.[k]" /></span>
                        </label>
                      }
                    }
                  </div>
                }
              </article>
            }
          </section>
          <aside class="md:sticky md:top-24 md:self-start" aria-label="Bảng câu hỏi">
            <p class="mb-2 text-sm font-semibold">
              Đã làm {{ answered() }}/{{ questions().length }}
            </p>
            <ul class="grid grid-cols-5 gap-1">
              @for (q of questions(); track q.id; let i = $index) {
                <li>
                  <button
                    type="button"
                    class="h-9 w-full rounded border text-sm font-semibold"
                    [class]="
                      isDone(q)
                        ? 'border-primary-700 bg-primary-700 text-white'
                        : 'border-gray-300 dark:border-gray-600'
                    "
                    [attr.aria-label]="'Đến câu ' + (i + 1) + (isDone(q) ? ' (đã làm)' : '')"
                    (click)="goTo(q.id)"
                  >
                    {{ i + 1 }}
                  </button>
                </li>
              }
            </ul>
          </aside>
        </div>
      }
    </div>
  `,
})
export class ExamRoom {
  private readonly api = inject(ExamTakingApi);
  private readonly alert = inject(AlertService);
  private readonly confirm = inject(ConfirmService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly code = normalizeCodeInput(inject(ActivatedRoute).snapshot.paramMap.get('code'));

  protected readonly keys = ['A', 'B', 'C', 'D'] as const;
  protected readonly maxEssay = MAX_ESSAY_CHARS;
  protected readonly loading = signal(true);
  protected readonly error = signal<TakeError | null>(null);
  protected readonly exam = signal<StartedExam | null>(null);
  protected readonly questions = signal<StudentQuestion[]>([]);
  protected readonly answers = signal<Record<number, string>>({});
  protected readonly essay = signal<Record<number, string>>({});
  protected readonly remaining = signal(0);
  protected readonly submitting = signal(false);
  protected readonly clock = computed(
    () => `${pad(Math.floor(this.remaining() / 60))}:${pad(this.remaining() % 60)}`,
  );
  protected readonly answered = computed(
    () => this.questions().filter((q) => this.isDone(q)).length,
  );
  protected readonly points = (q: StudentQuestion) => formatQuestionPoints(q.maxScore);

  private deadlineMs = 0; // client-clock deadline = server deadline shifted by the clock difference
  private finished = false; // submitted (or being left): no more timers / popups / unload guard
  private autoSubmitted = false;
  private violations: TabViolation[] = []; // plain array on purpose: not shown, sent with the submit
  private lastViolationAt = 0;
  private warningOpen = false;
  private sittingId = '';

  constructor() {
    const tick = setInterval(() => this.onTick(), 250);
    const resync = setInterval(() => this.resync(), RESYNC_MS);
    this.destroyRef.onDestroy(() => {
      clearInterval(tick);
      clearInterval(resync);
      this.detach();
    });
    void this.init();
  }

  private async init(): Promise<void> {
    try {
      const info = await firstValueFrom(this.api.resolve(this.code));
      if (info.myState === 'submitted')
        return void this.router.navigate(['/ca', this.code, 'done'], { replaceUrl: true });
      this.sittingId = info.id;
      const ex = await firstValueFrom(this.api.start(info.id));
      this.exam.set(ex);
      this.questions.set(arrangeQuestions(ex.questions, ex.questionOrder, ex.optionsOrder));
      this.setDeadline(ex.remainingSeconds);
      this.restoreDrafts();
      this.attach(ex.antiCheat);
      this.loading.set(false);
    } catch (e) {
      const err = describeTakeError(e);
      if (err.kind === 'submitted')
        return void this.router.navigate(['/ca', this.code, 'done'], { replaceUrl: true });
      this.error.set(err);
      this.loading.set(false);
    }
  }

  // ---- clock
  private setDeadline(remainingSeconds: number): void {
    this.deadlineMs = Date.now() + remainingSeconds * 1000;
    this.onTick();
  }
  private onTick(): void {
    if (!this.deadlineMs || this.finished) return;
    const left = Math.max(0, Math.ceil((this.deadlineMs - Date.now()) / 1000));
    if (left !== this.remaining()) this.remaining.set(left);
    if (left === 0 && !this.autoSubmitted) {
      this.autoSubmitted = true; // exactly once
      void this.submit(true);
    }
  }
  /** The teacher may have moved the times: ask the server for the real remaining time. */
  private resync = (): void => {
    if (!this.sittingId || this.finished) return;
    this.api.session(this.sittingId).subscribe({
      next: (c) => this.setDeadline(c.remainingSeconds),
      error: () => undefined, // keep the local clock; submit will tell the truth
    });
  };

  // ---- drafts
  private key = (kind: 'answers' | 'essay') => `draft_${kind}_${this.sittingId}`;
  private restoreDrafts(): void {
    try {
      const a = JSON.parse(store.get(this.key('answers')) ?? 'null') as Record<
        number,
        string
      > | null;
      const e = JSON.parse(store.get(this.key('essay')) ?? 'null') as Record<number, string> | null;
      if (a && typeof a === 'object') this.answers.set(a);
      if (e && typeof e === 'object') this.essay.set(e);
    } catch {
      /* a corrupt draft is ignored */
    }
  }
  protected setAnswer(id: number, k: string): void {
    this.answers.update((a) => ({ ...a, [id]: k }));
    store.set(this.key('answers'), JSON.stringify(this.answers()));
  }
  protected setEssay(id: number, text: string): void {
    this.essay.update((a) => ({ ...a, [id]: text.slice(0, MAX_ESSAY_CHARS) }));
    store.set(this.key('essay'), JSON.stringify(this.essay()));
  }
  protected isDone(q: StudentQuestion): boolean {
    return q.type === 'essay'
      ? Boolean((this.essay()[q.id] ?? '').trim())
      : Boolean(this.answers()[q.id]);
  }
  protected showContext(i: number): boolean {
    const list = this.questions();
    const ctx = (list[i].context ?? '').trim();
    return Boolean(ctx) && (i === 0 || (list[i - 1].context ?? '').trim() !== ctx);
  }
  protected goTo(id: number): void {
    document.getElementById(`q-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ---- anti-cheat
  private readonly listeners: [EventTarget, string, EventListener, boolean?][] = [];
  private on(target: EventTarget, type: string, fn: EventListener, capture = false): void {
    target.addEventListener(type, fn, capture);
    this.listeners.push([target, type, fn, capture]);
  }
  private detach(): void {
    for (const [t, type, fn, c] of this.listeners) t.removeEventListener(type, fn, c);
    this.listeners.length = 0;
  }
  private attach(antiCheat: boolean): void {
    this.on(window, 'beforeunload', ((e: BeforeUnloadEvent) => {
      if (!this.finished) e.preventDefault(); // leaving loses nothing server-side, but warns the student
    }) as EventListener);
    this.on(document, 'visibilitychange', (() => {
      if (document.visibilityState === 'hidden') this.log('Chuyển tab / thu nhỏ trình duyệt');
      else this.resync(); // back to the page: re-read the clock
    }) as EventListener);
    if (!antiCheat) return;
    this.on(window, 'blur', (() => this.log('Rời khỏi cửa sổ làm bài')) as EventListener);
    for (const action of ['paste', 'drop', 'copy', 'cut', 'contextmenu'] as AntiCheatAction[]) {
      this.on(
        document,
        action,
        ((e: Event) => {
          const inEssayInput = Boolean(
            (e.target as HTMLElement | null)?.closest?.('[data-essay-input]'),
          );
          const d = decideAntiCheatAction({ antiCheat, action, inEssayInput });
          if (d.block) e.preventDefault();
          if (d.reason) this.log(d.reason);
        }) as EventListener,
        true,
      );
    }
  }
  /** Debounced: one action often fires several events. Only logged when anti-cheat is on for blur/visibility too. */
  private log(reason: string): void {
    if (this.finished || !this.exam()?.antiCheat) return;
    const now = Date.now();
    if (now - this.lastViolationAt < VIOLATION_DEBOUNCE_MS) return;
    this.lastViolationAt = now;
    this.violations.push({ at: new Date(now).toISOString(), reason });
    if (this.warningOpen) return; // popups never stack
    this.warningOpen = true;
    void this.alert
      .warning(`Hệ thống đã ghi nhận hành vi: ${reason}. Vi phạm sẽ được gửi cho giáo viên.`, {
        title: 'Cảnh báo vi phạm',
      })
      .finally(() => (this.warningOpen = false));
  }

  // ---- submit
  protected async submit(auto: boolean): Promise<void> {
    if (this.submitting() || this.finished) return; // single-flight
    if (!auto) {
      const left = this.questions().length - this.answered();
      const ok = await this.confirm.confirm(
        left > 0
          ? `Bạn còn ${left} câu chưa làm. Vẫn nộp bài?`
          : 'Nộp bài? Bạn không thể làm lại sau khi nộp.',
        { title: 'Nộp bài?', confirmText: 'Nộp bài', cancelText: 'Làm tiếp' },
      );
      if (!ok) return;
    }
    this.submitting.set(true);
    const body: SubmitBody = {
      answers: Object.fromEntries(Object.entries(this.answers()).map(([k, v]) => [k, v])),
      essayAnswers: Object.fromEntries(
        Object.entries(this.essay())
          .filter(([, v]) => v.trim())
          .map(([k, v]) => [k, v]),
      ),
      isAutoSubmit: auto,
      tabViolations: this.violations,
    };
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= SUBMIT_ATTEMPTS; attempt += 1) {
      try {
        const res = await firstValueFrom(this.api.submit(this.sittingId, body));
        return this.done(res.warnings);
      } catch (e) {
        lastError = e;
        const kind = classifySubmitFailure(e);
        if (kind === 'done') return this.done(); // the server already has it
        if (kind === 'stop') break;
        if (attempt < SUBMIT_ATTEMPTS) await sleep(1500 * attempt); // network / 5xx: try again
      }
    }
    this.submitting.set(false);
    const err = describeTakeError(lastError);
    if (err.kind === 'submitted') return this.done();
    this.autoSubmitted = false; // a manual retry stays possible
    void this.alert.error(`Chưa nộp được bài: ${err.message}`);
  }
  private done(warnings?: string[]): void {
    this.finished = true;
    store.del(this.key('answers'));
    store.del(this.key('essay'));
    store.set(submissionResultKey(this.code), JSON.stringify({ warnings: warnings ?? [] }));
    this.detach();
    void this.router.navigate(['/ca', this.code, 'done'], { replaceUrl: true });
  }
}
