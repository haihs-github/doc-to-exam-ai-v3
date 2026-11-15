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
import { errorMessage } from '../core/api-errors';
import { AuthService } from '../core/auth.service';
import { ExamTakingApi, type UploadedEssay } from '../core/exam-taking.api';
import { AlertService } from '../shared/ui/alert.service';
import { ConfirmService } from '../shared/ui/confirm-modal';
import { FormattedText } from '../shared/ui/formatted-text';
// Haihs: phòng thi giống bản gốc (header, bảng câu hỏi, ô đáp án, ô tự luận) - start
// đóng code cũ
// import { Skeleton } from '../shared/ui/skeleton';
import { Icon } from '../shared/ui/icon';
import { ThemeToggle } from '../shared/ui/theme-toggle';
// Haihs: phòng thi giống bản gốc (header, bảng câu hỏi, ô đáp án, ô tự luận) - end
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
  // Haihs: phòng thi giống bản gốc (header, bảng câu hỏi, ô đáp án, ô tự luận) - start
  // đóng code cũ
  // imports: [RouterLink, FormattedText, Skeleton],
  imports: [RouterLink, FormattedText, Icon, ThemeToggle],
  // Haihs: phòng thi giống bản gốc (header, bảng câu hỏi, ô đáp án, ô tự luận) - end
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Haihs: phòng thi giống bản gốc (header, bảng câu hỏi, ô đáp án, ô tự luận) - start
  // đóng code cũ
  //   template: `
  //     <div class="mx-auto max-w-5xl space-y-4 px-3 py-4" data-allow-busy>
  //       @if (loading()) {
  //         <app-skeleton variant="list" />
  //       } @else if (error(); as e) {
  //         <div role="alert" class="space-y-3">
  //           <h1 class="text-xl font-bold">
  //             {{
  //               e.kind === 'not_granted' ? 'Bạn chưa được vào ca thi này' : 'Không vào được phòng thi'
  //             }}
  //           </h1>
  //           <p class="text-base">{{ e.message }}</p>
  //           <a routerLink="/sittings" class="btn-secondary inline-flex">Về danh sách ca thi</a>
  //         </div>
  //       } @else if (exam(); as ex) {
  //         <header
  //           class="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800"
  //         >
  //           <h1 class="min-w-0 break-words text-lg font-bold">{{ ex.title }}</h1>
  //           <div class="flex items-center gap-3">
  //             <span
  //               class="font-mono text-xl font-extrabold"
  //               [class.text-red-700]="remaining() <= 60"
  //               role="timer"
  //               [attr.aria-label]="'Thời gian còn lại ' + clock()"
  //               >{{ clock() }}</span
  //             >
  //             <button
  //               type="button"
  //               class="btn-primary"
  //               [disabled]="submitting()"
  //               (click)="submit(false)"
  //             >
  //               {{ submitting() ? 'Đang nộp...' : 'Nộp bài' }}
  //             </button>
  //           </div>
  //         </header>
  //         <div class="grid gap-4 md:grid-cols-[1fr_14rem]">
  //           <section class="space-y-4" aria-label="Câu hỏi">
  //             @for (q of questions(); track q.id; let i = $index) {
  //               @if (showContext(i)) {
  //                 <div class="rounded-lg bg-gray-50 p-3 text-base dark:bg-gray-900">
  //                   <app-formatted-text [text]="q.context" />
  //                 </div>
  //               }
  //               <article
  //                 [id]="'q-' + q.id"
  //                 class="space-y-2 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
  //                 [attr.aria-label]="'Câu ' + (i + 1)"
  //               >
  //                 <h2 class="font-bold">
  //                   Câu {{ i + 1 }}
  //                   <span class="font-normal text-gray-600 dark:text-gray-400">{{ points(q) }}</span>
  //                 </h2>
  //                 <p class="text-base"><app-formatted-text [text]="q.questionText" /></p>
  //                 @if (q.type === 'essay') {
  //                   @if (q.requirements) {
  //                     <p class="text-sm text-gray-600 dark:text-gray-400">
  //                       <app-formatted-text [text]="q.requirements" />
  //                     </p>
  //                   }
  //                   <textarea
  //                     data-essay-input
  //                     class="input min-h-[160px] w-full"
  //                     [attr.maxlength]="maxEssay"
  //                     [attr.aria-label]="'Bài làm câu ' + (i + 1)"
  //                     [value]="essay()[q.id] ?? ''"
  //                     (input)="setEssay(q.id, $any($event.target).value)"
  //                   ></textarea>
  //                   @if (token()) {
  //                     <div class="flex flex-wrap items-center gap-2 text-sm">
  //                       <label class="btn-secondary cursor-pointer">
  //                         {{
  //                           uploads()[q.id] ? 'Đổi tệp' : 'Tải tệp (.txt .docx .jpg .png .webp .pdf)'
  //                         }}
  //                         <input
  //                           type="file"
  //                           class="sr-only"
  //                           accept=".txt,.docx,.jpg,.jpeg,.png,.webp,.pdf"
  //                           [disabled]="uploading()"
  //                           (change)="onFile(q.id, $event)"
  //                         />
  //                       </label>
  //                       @if (uploads()[q.id]; as u) {
  //                         <span>Đã tải: {{ u.fileName }}. Tệp sẽ thay cho phần gõ ở trên.</span>
  //                       }
  //                       @if (uploadError()[q.id]) {
  //                         <span role="alert" class="font-medium text-red-700 dark:text-red-300">{{
  //                           uploadError()[q.id]
  //                         }}</span>
  //                       }
  //                     </div>
  //                   }
  //                 } @else {
  //                   <div
  //                     role="radiogroup"
  //                     class="space-y-1"
  //                     [attr.aria-label]="'Đáp án câu ' + (i + 1)"
  //                   >
  //                     @for (k of keys; track k) {
  //                       @if (q.options?.[k]) {
  //                         <label
  //                           class="flex cursor-pointer items-start gap-2 rounded-lg p-2 hover:bg-gray-50 dark:hover:bg-gray-700"
  //                         >
  //                           <input
  //                             type="radio"
  //                             [name]="'a-' + q.id"
  //                             [checked]="answers()[q.id] === k"
  //                             (change)="setAnswer(q.id, k)"
  //                           />
  //                           <span class="font-bold">{{ k }}.</span>
  //                           <span><app-formatted-text [text]="q.options?.[k]" /></span>
  //                         </label>
  //                       }
  //                     }
  //                   </div>
  //                 }
  //               </article>
  //             }
  //           </section>
  //           <aside class="md:sticky md:top-24 md:self-start" aria-label="Bảng câu hỏi">
  //             <p class="mb-2 text-sm font-semibold">
  //               Đã làm {{ answered() }}/{{ questions().length }}
  //             </p>
  //             <ul class="grid grid-cols-5 gap-1">
  //               @for (q of questions(); track q.id; let i = $index) {
  //                 <li>
  //                   <button
  //                     type="button"
  //                     class="h-9 w-full rounded border text-sm font-semibold"
  //                     [class]="
  //                       isDone(q)
  //                         ? 'border-primary-700 bg-primary-700 text-white'
  //                         : 'border-gray-300 dark:border-gray-600'
  //                     "
  //                     [attr.aria-label]="'Đến câu ' + (i + 1) + (isDone(q) ? ' (đã làm)' : '')"
  //                     (click)="goTo(q.id)"
  //                   >
  //                     {{ i + 1 }}
  //                   </button>
  //                 </li>
  //               }
  //             </ul>
  //           </aside>
  //         </div>
  //       }
  //     </div>
  //   `,
  template: `
    <div class="min-h-screen bg-gray-50 pb-16 dark:bg-gray-700/50" data-allow-busy>
      @if (loading()) {
        <div class="flex min-h-[70vh] items-center justify-center p-4" role="status">
          <div class="space-y-3 text-center">
            <div
              class="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-primary-300 border-t-transparent dark:border-sky-400/40"
            ></div>
            <p class="text-base font-semibold text-gray-600 dark:text-gray-300">
              Đang vào phòng thi...
            </p>
          </div>
        </div>
      } @else if (error(); as e) {
        <div class="flex min-h-[70vh] items-center justify-center bg-gray-50 p-4 dark:bg-gray-900">
          <div
            role="alert"
            class="w-full max-w-md space-y-4 rounded-xl border border-gray-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-800"
          >
            <div
              class="mx-auto flex h-14 w-14 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/40 dark:text-red-300"
            >
              <app-icon
                [name]="e.kind === 'not_granted' ? 'shield-alert' : 'alert-circle'"
                svgClass="h-8 w-8"
              />
            </div>
            <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">
              {{ e.kind === 'not_granted' ? 'Chưa Có Quyền Vào Ca Thi' : 'Không Thể Vào Ca Thi' }}
            </h2>
            <p class="text-base text-gray-600 dark:text-gray-300">{{ e.message }}</p>
            <a
              routerLink="/sittings"
              class="inline-block rounded-xl bg-primary-700 px-5 py-2.5 text-base font-bold text-white transition-colors hover:bg-primary-800 dark:bg-sky-400 dark:text-gray-900 dark:hover:bg-sky-300"
              >Về Ca thi của tôi</a
            >
          </div>
        </div>
      } @else if (exam(); as ex) {
        <header
          class="sticky top-0 z-40 border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
        >
          <div
            class="mx-auto flex h-16 w-full items-center justify-between gap-4 px-4 sm:h-20 sm:px-6 lg:px-8"
          >
            <div class="flex items-center gap-3 overflow-hidden sm:gap-4">
              <div
                class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-primary-700 text-white sm:h-11 sm:w-11 dark:bg-sky-400 dark:text-gray-900"
              >
                <app-icon name="file-question" svgClass="h-5 w-5" />
              </div>
              <div class="overflow-hidden">
                <h1 class="truncate text-base font-bold text-gray-900 dark:text-gray-100">
                  {{ ex.title }}
                </h1>
                <div
                  class="mt-0.5 flex items-center gap-2 text-base text-gray-600 sm:gap-3 dark:text-gray-300"
                >
                  <span class="truncate font-semibold text-primary-700 dark:text-sky-400">{{
                    userName()
                  }}</span>
                  @if (ex.antiCheat) {
                    <span class="hidden text-gray-400 sm:inline dark:text-gray-500">•</span>
                    <span
                      class="badge hidden border-red-200 bg-red-50 text-red-700 sm:inline-flex dark:border-red-800 dark:bg-red-900/40 dark:text-red-300"
                    >
                      <app-icon
                        name="shield-alert"
                        svgClass="h-3 w-3 text-red-700 dark:text-red-300"
                      />
                      Chống gian lận
                    </span>
                  }
                </div>
              </div>
            </div>
            <div class="flex flex-shrink-0 items-center gap-2 sm:gap-4">
              <app-theme-toggle />
              <div
                role="timer"
                [attr.aria-label]="'Thời gian còn lại ' + clock()"
                title="Thời gian còn lại do máy chủ quản lý"
                class="flex items-center gap-2 rounded-xl border px-3.5 py-1.5 font-mono text-base font-bold transition-all"
                [class]="timerCls()"
              >
                @if (remaining() <= 60) {
                  <app-icon
                    name="alert-triangle"
                    class="animate-bounce"
                    svgClass="h-4 w-4 text-red-700 dark:text-red-300"
                  />
                } @else {
                  <app-icon
                    name="clock"
                    [svgClass]="
                      'h-4 w-4 ' +
                      (remaining() <= 300
                        ? 'text-amber-700 dark:text-amber-300'
                        : 'text-gray-500 dark:text-gray-400')
                    "
                  />
                }
                <span>{{ clock() }}</span>
              </div>
              <button
                type="button"
                (click)="submit(false)"
                [disabled]="submitting()"
                class="flex min-h-[48px] items-center gap-1.5 rounded-xl bg-primary-700 px-3.5 py-2 text-base font-bold text-white transition-all hover:bg-primary-800 disabled:opacity-50 sm:px-5 dark:bg-sky-400 dark:text-gray-900 dark:hover:bg-sky-300"
              >
                <app-icon name="send" svgClass="h-4 w-4" />
                <span class="hidden sm:inline">{{ submitting() ? 'Đang nộp...' : 'Nộp Bài' }}</span>
              </button>
            </div>
          </div>
        </header>

        <main class="mx-auto w-full px-4 py-8 sm:px-6 lg:px-8">
          @if (timeUp()) {
            <div
              role="alert"
              class="mb-6 flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-base font-semibold text-red-700 dark:border-red-800 dark:bg-red-900/40 dark:text-red-300"
            >
              <app-icon
                name="alert-circle"
                class="flex-none"
                svgClass="h-5 w-5 text-red-700 dark:text-red-300"
              />
              <span>Đã hết thời gian làm bài. Hệ thống đang tự động thu bài của bạn...</span>
            </div>
          }
          <div class="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
            <div class="space-y-6 lg:col-span-8" [class.select-none]="ex.antiCheat">
              <div
                class="flex items-center justify-between rounded-xl border border-primary-300 bg-primary-50/70 p-4 text-base text-primary-700 dark:border-sky-400/40 dark:bg-sky-400/10 dark:text-sky-400"
              >
                <div>
                  @if (essayCount() > 0) {
                    Đề thi gồm
                    <strong
                      >{{ mcqCount() }} câu trắc nghiệm và {{ essayCount() }} câu tự luận</strong
                    >. Chọn đáp án cho câu trắc nghiệm; với câu tự luận hãy gõ bài hoặc tải lên đúng
                    1 tệp, rồi nộp bài trước khi hết giờ.
                  } @else {
                    Đề thi gồm <strong>{{ questions().length }} câu trắc nghiệm</strong>. Chọn đáp
                    án cho từng câu và nộp bài trước khi hết giờ.
                  }
                </div>
                <div class="ml-2 whitespace-nowrap font-bold text-primary-700 dark:text-sky-400">
                  {{ answered() }}/{{ questions().length }} đã làm
                </div>
              </div>

              @for (q of questions(); track q.id; let i = $index) {
                @if (showContext(i)) {
                  <div
                    class="rounded-xl border border-primary-200/70 bg-primary-50/50 p-4 text-base leading-relaxed text-gray-800 dark:border-sky-800 dark:bg-sky-900/30 dark:text-gray-100"
                  >
                    <app-formatted-text [text]="q.context" />
                  </div>
                }
                <div
                  [id]="'q-' + q.id"
                  class="relative scroll-mt-24 rounded-xl border border-gray-200/80 bg-white p-5 transition-all sm:p-6 dark:border-gray-700 dark:bg-gray-800"
                  [attr.aria-label]="'Câu ' + (i + 1)"
                >
                  <div class="mb-3 flex flex-wrap items-start gap-3">
                    <span
                      class="inline-flex flex-shrink-0 items-center justify-center rounded-lg bg-primary-700 px-2.5 py-1 text-sm font-bold text-white sm:text-base dark:bg-sky-400 dark:text-gray-900"
                    >
                      Câu {{ i + 1 }}
                    </span>
                    @if (q.type === 'essay') {
                      <span
                        class="inline-flex items-center rounded-lg border border-primary-200 bg-primary-50 px-2.5 py-1 text-sm font-bold text-primary-800 dark:border-sky-800 dark:bg-sky-900/30 dark:text-sky-400"
                      >
                        Tự luận • tối đa {{ q.maxScore }} điểm
                      </span>
                    } @else if (points(q)) {
                      <span
                        class="flex-shrink-0 whitespace-nowrap pt-1.5 text-sm font-semibold text-gray-500 dark:text-gray-400"
                        >{{ points(q) }}</span
                      >
                    }
                  </div>
                  @if (q.questionText) {
                    <div
                      class="mb-3 whitespace-pre-line text-lg font-normal leading-relaxed text-gray-800 dark:text-gray-100"
                    >
                      <app-formatted-text [text]="q.questionText" />
                    </div>
                  }
                  @if (q.type === 'essay') {
                    @if (q.requirements) {
                      <div
                        class="mb-3 whitespace-pre-line rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm leading-relaxed text-gray-700 sm:text-base dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                      >
                        <div class="mb-1 font-bold text-gray-800 dark:text-gray-100">Yêu cầu</div>
                        <app-formatted-text [text]="q.requirements" />
                      </div>
                    }
                    <div class="space-y-4 pt-1">
                      <div>
                        <label
                          [for]="'essay-text-' + q.id"
                          class="mb-1.5 block text-sm font-bold text-gray-700 dark:text-gray-200"
                          >Bài làm (gõ trực tiếp)</label
                        >
                        <textarea
                          [id]="'essay-text-' + q.id"
                          data-essay-input
                          rows="10"
                          [attr.maxlength]="maxEssay"
                          [attr.aria-label]="'Bài làm câu ' + (i + 1)"
                          placeholder="Nhập bài làm của bạn vào đây..."
                          spellcheck="false"
                          class="w-full resize-y select-text rounded-xl border border-gray-300 bg-white p-3.5 text-base leading-relaxed text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:focus:ring-sky-400"
                          [value]="essay()[q.id] ?? ''"
                          (input)="setEssay(q.id, $any($event.target).value)"
                        ></textarea>
                        <div class="mt-1 flex items-center justify-between text-base font-medium">
                          <span class="text-gray-500 dark:text-gray-400">{{ words(q.id) }} từ</span>
                          <span
                            [class]="
                              chars(q.id) >= maxEssay
                                ? 'font-bold text-red-600 dark:text-red-400'
                                : chars(q.id) >= maxEssay * 0.9
                                  ? 'font-bold text-amber-600 dark:text-amber-300'
                                  : 'text-gray-500 dark:text-gray-400'
                            "
                          >
                            {{ chars(q.id).toLocaleString('vi-VN') }}/{{
                              maxEssay.toLocaleString('vi-VN')
                            }}
                            ký tự{{ chars(q.id) >= maxEssay ? ' (đã đạt giới hạn)' : '' }}
                          </span>
                        </div>
                      </div>
                      @if (token()) {
                        <div
                          class="space-y-2.5 rounded-xl border border-dashed border-gray-300 bg-gray-50/70 p-3.5 dark:border-gray-600 dark:bg-gray-900"
                        >
                          <div class="flex flex-wrap items-center justify-between gap-2">
                            <div class="text-sm font-bold text-gray-700 dark:text-gray-200">
                              Hoặc tải lên đúng 1 tệp bài làm
                            </div>
                            <label
                              class="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-primary-200 bg-white px-3 py-1.5 text-sm font-bold text-primary-800 transition-colors hover:bg-primary-50 dark:border-sky-800 dark:bg-gray-800 dark:text-sky-400 dark:hover:bg-sky-900/30"
                              [class.opacity-50]="uploading()"
                            >
                              <app-icon name="upload" svgClass="h-3.5 w-3.5" />
                              {{ uploads()[q.id] ? 'Đổi tệp khác' : 'Chọn tệp' }}
                              <input
                                type="file"
                                class="sr-only"
                                accept=".txt,.docx,.jpg,.jpeg,.png,.webp,.pdf"
                                [disabled]="uploading()"
                                (change)="onFile(q.id, $event)"
                              />
                            </label>
                          </div>
                          <p class="text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                            Nhận ảnh (JPG, PNG, WebP), PDF, Word (.docx) hoặc .txt. Ảnh được tự nén
                            trước khi gửi. Chưa nhận ảnh HEIC của iPhone: hãy chụp ở chế độ JPEG
                            ("Tương thích nhất").
                          </p>
                          @if (uploadingId() === q.id) {
                            <div
                              role="status"
                              class="flex items-center gap-2 rounded-lg border border-primary-200 bg-primary-50 p-2.5 text-sm font-semibold text-primary-900 dark:border-sky-800 dark:bg-sky-900/30 dark:text-sky-400"
                            >
                              <app-icon
                                name="loader-2"
                                class="flex-none animate-spin"
                                svgClass="h-3.5 w-3.5"
                              />
                              <span class="truncate">Đang tải lên...</span>
                            </div>
                          }
                          @if (uploads()[q.id]; as u) {
                            <div
                              class="flex items-center gap-2.5 rounded-lg border border-green-200 bg-green-50 p-2.5 text-sm text-green-900 dark:border-green-800 dark:bg-green-900/40 dark:text-green-300"
                            >
                              <app-icon
                                [name]="u.kind === 'media' ? 'image' : 'file-text'"
                                class="flex-none"
                                svgClass="h-5 w-5 text-green-600 dark:text-green-300"
                              />
                              <div class="min-w-0 flex-1">
                                <div class="flex items-center gap-1 truncate font-bold">
                                  <app-icon
                                    name="check-circle-2"
                                    class="flex-none"
                                    svgClass="h-3.5 w-3.5 text-green-600 dark:text-green-300"
                                  />
                                  <span class="truncate">Đã tải lên: {{ u.fileName }}</span>
                                </div>
                                <div class="text-sm text-green-800/80 dark:text-green-300">
                                  Tệp sẽ thay cho phần gõ ở trên.
                                </div>
                              </div>
                              <button
                                type="button"
                                (click)="removeUpload(q.id)"
                                class="flex-none rounded p-1 text-green-800 hover:bg-green-100 dark:text-green-300 dark:hover:bg-green-900/60"
                                aria-label="Gỡ tệp"
                                title="Gỡ tệp"
                              >
                                <app-icon name="x" svgClass="h-4 w-4" />
                              </button>
                            </div>
                          }
                          @if (uploadError()[q.id]) {
                            <p
                              role="alert"
                              class="flex items-start gap-1.5 text-sm font-medium text-red-700 dark:text-red-300"
                            >
                              <app-icon
                                name="alert-circle"
                                class="mt-0.5 flex-none"
                                svgClass="h-3.5 w-3.5"
                              />
                              {{ uploadError()[q.id] }}
                            </p>
                          }
                        </div>
                      }
                    </div>
                  } @else {
                    <div
                      role="radiogroup"
                      class="grid grid-cols-1 gap-2.5 pt-0.5"
                      [attr.aria-label]="'Đáp án câu ' + (i + 1)"
                    >
                      @for (k of keys; track k) {
                        @if (q.options?.[k]) {
                          <label
                            class="flex min-h-[56px] cursor-pointer select-none items-center gap-3 rounded-xl border p-3 px-4 text-lg transition-all"
                            [class]="
                              answers()[q.id] === k
                                ? 'border-primary-600 bg-primary-50 text-primary-900 ring-2 ring-primary-600/20 dark:border-sky-400 dark:bg-sky-900/30 dark:text-sky-400 dark:ring-sky-400'
                                : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'
                            "
                          >
                            <input
                              type="radio"
                              class="sr-only"
                              [name]="'a-' + q.id"
                              [checked]="answers()[q.id] === k"
                              (change)="setAnswer(q.id, k)"
                            />
                            <div
                              class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded text-base font-bold transition-colors"
                              [class]="
                                answers()[q.id] === k
                                  ? 'bg-primary-700 text-white dark:bg-sky-400'
                                  : 'border border-gray-300 bg-gray-100 text-gray-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400'
                              "
                            >
                              {{ k }}
                            </div>
                            <span
                              class="flex-1 break-words pt-0.5 text-lg font-normal leading-relaxed text-gray-800 dark:text-gray-100"
                            >
                              <app-formatted-text [text]="q.options?.[k]" />
                            </span>
                          </label>
                        }
                      }
                    </div>
                  }
                </div>
              }
            </div>

            <div class="sticky top-24 sm:top-28 lg:col-span-4" aria-label="Bảng câu hỏi">
              <div class="card flex h-full flex-col p-4 sm:p-5">
                <div class="border-b border-gray-200 pb-4 dark:border-gray-700">
                  <div class="mb-2 flex items-center justify-between">
                    <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100">
                      Danh Sách Câu Hỏi
                    </h3>
                    <span
                      class="badge bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100"
                      >{{ answered() }}/{{ questions().length }} câu</span
                    >
                  </div>
                  <div
                    class="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700"
                  >
                    <div
                      class="h-2.5 rounded-full bg-primary-700 transition-all duration-300 dark:bg-sky-400"
                      [style.width.%]="progress()"
                    ></div>
                  </div>
                  <div
                    class="mt-1.5 flex items-center justify-between text-base text-gray-600 dark:text-gray-400"
                  >
                    <span>Tiến độ làm bài</span>
                    <span>{{ progress() }}%</span>
                  </div>
                </div>
                <div
                  class="flex items-center gap-4 border-b border-gray-200 py-3 text-base text-gray-700 dark:border-gray-700 dark:text-gray-300"
                >
                  <div class="flex items-center gap-1.5">
                    <span
                      class="inline-block h-4 w-4 rounded bg-primary-700 dark:bg-sky-400"
                    ></span>
                    <span>Đã chọn</span>
                  </div>
                  <div class="flex items-center gap-1.5">
                    <span
                      class="inline-block h-4 w-4 rounded border border-gray-400 bg-white dark:bg-gray-800"
                    ></span>
                    <span>Chưa chọn</span>
                  </div>
                </div>
                <div class="max-h-[50vh] flex-1 overflow-y-auto py-3 pr-1 sm:max-h-[420px]">
                  <div class="grid grid-cols-4 gap-2 sm:grid-cols-5">
                    @for (q of questions(); track q.id; let i = $index) {
                      <button
                        type="button"
                        class="flex h-11 min-w-[44px] cursor-pointer items-center justify-center rounded-lg text-base font-medium transition-colors"
                        [class]="
                          isDone(q)
                            ? 'bg-primary-700 text-white hover:bg-primary-800 dark:bg-sky-400 dark:text-gray-900 dark:hover:bg-sky-300'
                            : 'border border-gray-400 bg-white text-gray-800 hover:bg-gray-100 dark:border-gray-500 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700'
                        "
                        [attr.title]="'Câu ' + (i + 1) + ': ' + (isDone(q) ? 'Đã làm' : 'Chưa làm')"
                        [attr.aria-label]="'Đến câu ' + (i + 1) + (isDone(q) ? ' (đã làm)' : '')"
                        (click)="goTo(q.id)"
                      >
                        {{ i + 1 }}
                      </button>
                    }
                  </div>
                </div>
                <div class="mt-auto border-t border-gray-200 pt-4 dark:border-gray-700">
                  <button
                    type="button"
                    (click)="submit(false)"
                    [disabled]="submitting()"
                    class="btn-primary w-full"
                  >
                    <app-icon name="send" svgClass="h-5 w-5" />
                    {{ submitting() ? 'Đang Nộp Bài...' : 'Nộp Bài Thi' }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>
      }
    </div>
  `,
  // Haihs: phòng thi giống bản gốc (header, bảng câu hỏi, ô đáp án, ô tự luận) - end
})
export class ExamRoom {
  private readonly api = inject(ExamTakingApi);
  // Haihs: phòng thi giống bản gốc (header, bảng câu hỏi, ô đáp án, ô tự luận) - start
  private readonly auth = inject(AuthService);
  // Haihs: phòng thi giống bản gốc (header, bảng câu hỏi, ô đáp án, ô tự luận) - end
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
  protected readonly uploads = signal<Record<number, UploadedEssay>>({});
  protected readonly uploadError = signal<Record<number, string>>({});
  protected readonly uploading = signal(false);
  // Haihs: phòng thi giống bản gốc (header, bảng câu hỏi, ô đáp án, ô tự luận) - start
  protected readonly uploadingId = signal<number | null>(null);
  protected readonly timeUp = signal(false);
  protected readonly userName = computed(() => this.auth.user()?.fullName ?? '');
  protected readonly essayCount = computed(
    () => this.questions().filter((q) => q.type === 'essay').length,
  );
  protected readonly mcqCount = computed(() => this.questions().length - this.essayCount());
  protected readonly progress = computed(() =>
    this.questions().length ? Math.round((this.answered() / this.questions().length) * 100) : 0,
  );
  /** Timer chip colours: grey, amber under 5 minutes, pulsing red under 1 minute. */
  protected readonly timerCls = computed(() => {
    const r = this.remaining();
    if (r <= 0)
      return 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/40 dark:text-red-300';
    if (r <= 60)
      return 'animate-pulse border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/40 dark:text-red-300';
    if (r <= 300)
      return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/40 dark:text-amber-300';
    return 'border-gray-200 bg-gray-100 text-gray-800 dark:border-gray-700 dark:bg-gray-700 dark:text-gray-100';
  });
  protected readonly chars = (id: number): number => (this.essay()[id] ?? '').length;
  protected readonly words = (id: number): number =>
    ((this.essay()[id] ?? '').trim().match(/\S+/g) ?? []).length;
  // Haihs: phòng thi giống bản gốc (header, bảng câu hỏi, ô đáp án, ô tự luận) - end
  protected readonly token = computed(() => this.exam()?.uploadToken ?? '');
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
      // Haihs: phòng thi giống bản gốc (header, bảng câu hỏi, ô đáp án, ô tự luận) - start
      this.timeUp.set(true);
      // Haihs: phòng thi giống bản gốc (header, bảng câu hỏi, ô đáp án, ô tự luận) - end
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

  /** One file per essay question; the server decides by MAGIC BYTES, so a renamed file is refused there. */
  protected async onFile(id: number, e: Event): Promise<void> {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || this.uploading()) return;
    this.uploading.set(true);
    // Haihs: phòng thi giống bản gốc (header, bảng câu hỏi, ô đáp án, ô tự luận) - start
    this.uploadingId.set(id);
    // Haihs: phòng thi giống bản gốc (header, bảng câu hỏi, ô đáp án, ô tự luận) - end
    this.uploadError.update((m) => ({ ...m, [id]: '' }));
    try {
      const up = await firstValueFrom(this.api.uploadEssay(this.token(), id, file));
      this.uploads.update((m) => ({ ...m, [id]: up }));
    } catch (err) {
      this.uploadError.update((m) => ({ ...m, [id]: errorMessage(err) }));
    } finally {
      this.uploading.set(false);
      // Haihs: phòng thi giống bản gốc (header, bảng câu hỏi, ô đáp án, ô tự luận) - start
      this.uploadingId.set(null);
      // Haihs: phòng thi giống bản gốc (header, bảng câu hỏi, ô đáp án, ô tự luận) - end
    }
    // Haihs: phòng thi giống bản gốc (header, bảng câu hỏi, ô đáp án, ô tự luận) - start
  }

  /** Drops the chosen file of a question (the typed text counts again). */
  protected removeUpload(id: number): void {
    this.uploads.update((m) =>
      Object.fromEntries(Object.entries(m).filter(([k]) => Number(k) !== id)),
    );
    // Haihs: phòng thi giống bản gốc (header, bảng câu hỏi, ô đáp án, ô tự luận) - end
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
        this.questions()
          .filter((q) => q.type === 'essay')
          .map((q) => [
            q.id,
            {
              text: this.essay()[q.id] ?? '',
              ...(this.uploads()[q.id] ? { uploadId: this.uploads()[q.id].uploadId } : {}),
            },
          ])
          .filter(
            ([, v]) =>
              (v as { text: string; uploadId?: string }).text.trim() ||
              (v as { uploadId?: string }).uploadId,
          ),
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
