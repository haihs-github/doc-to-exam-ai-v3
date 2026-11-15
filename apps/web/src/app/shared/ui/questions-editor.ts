// Created by Haihs on 12/11/2026
// <app-questions-editor>: edit the questions of a template (mcq and essay with rubric). Port of QuestionsEditor/QuestionCard/EssayQuestionEditor.
// Haihs: trình soạn câu hỏi có chế độ Xem như học sinh, Chèn câu và nhãn như bản gốc - start
// đóng code cũ
// import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { ChangeDetectionStrategy, Component, computed, input, model, signal } from '@angular/core';
// Haihs: trình soạn câu hỏi có chế độ Xem như học sinh, Chèn câu và nhãn như bản gốc - end
import {
  EditorQuestion,
  OptionKey,
  RubricItem,
  computeScoringPreview,
  convertQuestionType,
  createEssayQuestion,
  createMcqQuestion,
  essayScoreError,
  isEssay,
  maxAllowedForQuestion,
  nextRubricKey,
  questionErrorsOf,
  redistributeCriteria,
  remainingScore,
  sumRubric,
} from '../utils/exam-questions';
import { FormattedText } from './formatted-text';
import { Icon } from './icon';

const OPTS: OptionKey[] = ['A', 'B', 'C', 'D'];
const AREA = 'input min-h-[72px] w-full';

@Component({
  selector: 'app-questions-editor',
  // Haihs: icon cho nút giống bản gốc - start
  // đóng code cũ
  // imports: [FormattedText],
  imports: [FormattedText, Icon],
  // Haihs: icon cho nút giống bản gốc - end
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Haihs: trình soạn câu hỏi có chế độ Xem như học sinh, Chèn câu và nhãn như bản gốc - start
  // đóng code cũ
  //   template: `
  //     <section class="space-y-4" aria-label="Danh sách câu hỏi">
  //       <div class="flex flex-wrap items-center justify-between gap-3">
  //         <h2 class="text-lg font-bold text-gray-900 dark:text-gray-100">
  //           Câu hỏi ({{ questions().length }})
  //         </h2>
  //         <p class="text-base text-gray-700 dark:text-gray-300" role="status">
  //           Thang điểm: trắc nghiệm {{ scoring().mcqMax }} · tự luận {{ scoring().essayMax }}
  //           @if (scoring().essayMax > 0) {
  //             · {{ remaining().label }}
  //           }
  //         </p>
  //       </div>
  //       @if (errors()['_scoring']) {
  //         <p role="alert" class="text-sm font-medium text-red-700 dark:text-red-300">
  //           {{ errors()['_scoring'] }}
  //         </p>
  //       }
  //       @if (errors()['questions']) {
  //         <p role="alert" class="text-sm font-medium text-red-700 dark:text-red-300">
  //           {{ errors()['questions'] }}
  //         </p>
  //       }

  //       <fieldset [disabled]="readOnly()" class="space-y-4">
  //         @for (q of questions(); track q.id; let i = $index) {
  //           @let qe = errorsOf(q.id);
  //           <article
  //             class="space-y-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
  //             [attr.aria-label]="'Câu ' + (i + 1)"
  //           >
  //             <header class="flex flex-wrap items-center justify-between gap-2">
  //               <h3 class="font-bold">
  //                 Câu {{ i + 1 }} · {{ isEssay(q) ? 'Tự luận' : 'Trắc nghiệm' }}
  //               </h3>
  //               <div class="flex flex-wrap gap-2">
  //                 <button
  //                   type="button"
  //                   class="btn-secondary"
  //                   [disabled]="i === 0"
  //                   (click)="move(i, -1)"
  //                   [attr.aria-label]="'Đưa câu ' + (i + 1) + ' lên'"
  //                 >
  //                   ↑
  //                 </button>
  //                 <button
  //                   type="button"
  //                   class="btn-secondary"
  //                   [disabled]="i === questions().length - 1"
  //                   (click)="move(i, 1)"
  //                   [attr.aria-label]="'Đưa câu ' + (i + 1) + ' xuống'"
  //                 >
  //                   ↓
  //                 </button>
  //                 <button type="button" class="btn-secondary" (click)="switchType(q)">
  //                   Đổi sang {{ isEssay(q) ? 'trắc nghiệm' : 'tự luận' }}
  //                 </button>
  //                 <button
  //                   type="button"
  //                   class="btn-danger"
  //                   (click)="remove(q.id)"
  //                   [attr.aria-label]="'Xóa câu ' + (i + 1)"
  //                 >
  //                   <!-- Haihs: icon cho nút giống bản gốc - start -->
  //                   <!-- đóng code cũ -->
  //                   <!-- Xóa -->
  //                   <app-icon name="trash-2" svgClass="h-4 w-4" /> Xóa
  //                   <!-- Haihs: icon cho nút giống bản gốc - end -->
  //                 </button>
  //               </div>
  //             </header>

  //             @if (q.needsReview) {
  //               <div
  //                 role="note"
  //                 class="rounded-lg bg-amber-50 p-3 text-base text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
  //               >
  //                 {{ q.reviewReason || 'Cần xác nhận loại câu hỏi.' }}
  //                 <button
  //                   type="button"
  //                   class="ml-2 font-semibold underline"
  //                   (click)="patch(q.id, { needsReview: false, reviewReason: '' })"
  //                 >
  //                   Xác nhận
  //                 </button>
  //               </div>
  //               @if (qe['review']) {
  //                 <p role="alert" class="text-sm font-medium text-red-700 dark:text-red-300">
  //                   {{ qe['review'] }}
  //                 </p>
  //               }
  //             }

  //             <label class="block text-base font-medium"
  //               >Chỉ dẫn / bài đọc (dùng chung nhóm câu)
  //               <textarea
  //                 [class]="area"
  //                 [value]="q.context"
  //                 (input)="text(q.id, 'context', $event)"
  //               ></textarea>
  //             </label>
  //             <label class="block text-base font-medium"
  //               >{{ isEssay(q) ? 'Đề bài' : 'Nội dung câu hỏi' }}
  //               <textarea
  //                 [class]="area"
  //                 [value]="q.questionText"
  //                 (input)="text(q.id, 'questionText', $event)"
  //               ></textarea>
  //             </label>
  //             @if (qe['text']) {
  //               <p role="alert" class="text-sm font-medium text-red-700 dark:text-red-300">
  //                 {{ qe['text'] }}
  //               </p>
  //             }

  //             @if (isEssay(q)) {
  //               <label class="block text-base font-medium"
  //                 >Yêu cầu
  //                 <textarea
  //                   [class]="area"
  //                   [value]="q.requirements ?? ''"
  //                   (input)="text(q.id, 'requirements', $event)"
  //                 ></textarea>
  //               </label>
  //               <div class="space-y-2">
  //                 <label class="block text-base font-medium"
  //                   >Điểm của câu (bội số của 0,25)
  //                   <input
  //                     type="text"
  //                     inputmode="decimal"
  //                     class="input w-32"
  //                     [value]="q.maxScore ?? ''"
  //                     (input)="setScore(i, $event)"
  //                   />
  //                 </label>
  //                 @if (scoreError(i); as se) {
  //                   <p role="alert" class="text-sm font-medium text-red-700 dark:text-red-300">
  //                     {{ se }}
  //                   </p>
  //                 }
  //                 @if (qe['score']) {
  //                   <p role="alert" class="text-sm font-medium text-red-700 dark:text-red-300">
  //                     {{ qe['score'] }}
  //                   </p>
  //                 }
  //                 <h4 class="font-semibold">Tiêu chí chấm (tổng {{ sum(q) }})</h4>
  //                 @for (c of q.rubric ?? []; track c.key; let ci = $index) {
  //                   <div class="flex flex-wrap items-center gap-2">
  //                     <input
  //                       class="input flex-1"
  //                       [value]="c.label"
  //                       (input)="setCriterion(q, ci, 'label', $event)"
  //                       [attr.aria-label]="'Tên tiêu chí ' + (ci + 1)"
  //                     />
  //                     <input
  //                       type="text"
  //                       inputmode="decimal"
  //                       class="input w-24"
  //                       [value]="c.max"
  //                       (input)="setCriterion(q, ci, 'max', $event)"
  //                       [attr.aria-label]="'Điểm tiêu chí ' + (ci + 1)"
  //                     />
  //                     <button
  //                       type="button"
  //                       class="btn-secondary"
  //                       (click)="removeCriterion(q, ci)"
  //                       [attr.aria-label]="'Xóa tiêu chí ' + (ci + 1)"
  //                     >
  //                       <!-- Haihs: icon cho nút giống bản gốc - start -->
  //                       <!-- đóng code cũ -->
  //                       <!-- Xóa -->
  //                       <app-icon name="trash-2" svgClass="h-4 w-4" /> Xóa
  //                       <!-- Haihs: icon cho nút giống bản gốc - end -->
  //                     </button>
  //                   </div>
  //                   @if (qe['criteria:' + ci + ':label']) {
  //                     <p role="alert" class="text-sm font-medium text-red-700 dark:text-red-300">
  //                       {{ qe['criteria:' + ci + ':label'] }}
  //                     </p>
  //                   }
  //                   @if (qe['criteria:' + ci + ':max']) {
  //                     <p role="alert" class="text-sm font-medium text-red-700 dark:text-red-300">
  //                       {{ qe['criteria:' + ci + ':max'] }}
  //                     </p>
  //                   }
  //                 }
  //                 @if (qe['criteria']) {
  //                   <p role="alert" class="text-sm font-medium text-red-700 dark:text-red-300">
  //                     {{ qe['criteria'] }}
  //                   </p>
  //                 }
  //                 <button type="button" class="btn-secondary" (click)="addCriterion(q)">
  //                   <!-- Haihs: icon cho nút giống bản gốc - start -->
  //                   <!-- đóng code cũ -->
  //                   <!-- Thêm tiêu chí -->
  //                   <app-icon name="plus" svgClass="h-4 w-4" /> Thêm tiêu chí
  //                   <!-- Haihs: icon cho nút giống bản gốc - end -->
  //                 </button>
  //               </div>
  //             } @else {
  //               <div
  //                 class="space-y-2"
  //                 role="radiogroup"
  //                 [attr.aria-label]="'Đáp án đúng của câu ' + (i + 1)"
  //               >
  //                 @for (k of opts; track k) {
  //                   <div class="flex items-center gap-2">
  //                     <input
  //                       type="radio"
  //                       [name]="'correct-' + q.id"
  //                       [checked]="q.correctAnswer === k"
  //                       (change)="patch(q.id, { correctAnswer: k })"
  //                       [attr.aria-label]="'Chọn ' + k + ' là đáp án đúng'"
  //                     />
  //                     <span class="w-5 font-bold">{{ k }}</span>
  //                     <input
  //                       class="input flex-1"
  //                       [value]="q.options[k]"
  //                       (input)="setOption(q.id, k, $event)"
  //                       [attr.aria-label]="'Phương án ' + k + ' của câu ' + (i + 1)"
  //                     />
  //                   </div>
  //                 }
  //                 @if (qe['options']) {
  //                   <p role="alert" class="text-sm font-medium text-red-700 dark:text-red-300">
  //                     {{ qe['options'] }}
  //                   </p>
  //                 }
  //                 @if (qe['correct']) {
  //                   <p role="alert" class="text-sm font-medium text-red-700 dark:text-red-300">
  //                     {{ qe['correct'] }}
  //                   </p>
  //                 }
  //               </div>
  //             }
  //             <label class="block text-base font-medium"
  //               >Giải thích
  //               <textarea
  //                 [class]="area"
  //                 [value]="q.explanation"
  //                 (input)="text(q.id, 'explanation', $event)"
  //               ></textarea>
  //             </label>
  //             <details class="text-sm text-gray-600 dark:text-gray-400">
  //               <summary class="cursor-pointer">Xem trước</summary>
  //               <div class="mt-2 space-y-1">
  //                 <p><app-formatted-text [text]="q.context" /></p>
  //                 <p><app-formatted-text [text]="q.questionText" /></p>
  //                 @if (!isEssay(q)) {
  //                   @for (k of opts; track k) {
  //                     <p>{{ k }}. <app-formatted-text [text]="q.options[k]" /></p>
  //                   }
  //                 }
  //               </div>
  //             </details>
  //           </article>
  //         }
  //       </fieldset>

  //       @if (!readOnly()) {
  //         <div class="flex flex-wrap gap-2">
  //           <button type="button" class="btn-secondary" (click)="addMcq()">
  //             Thêm câu trắc nghiệm
  //           </button>
  //           <button type="button" class="btn-secondary" (click)="addEssay()">Thêm câu tự luận</button>
  //         </div>
  //       }
  //     </section>
  //   `,
  // Haihs: trình soạn có bảng đáp án và điều hướng, nút gạch chân, banner cần xác nhận loại câu như bản gốc - start
  // đóng code cũ
  //   template: `
  //     <section class="space-y-4" aria-label="Danh sách câu hỏi">
  //       <div class="flex flex-wrap items-center justify-between gap-3">
  //         <h2 class="text-lg font-bold text-gray-900 dark:text-gray-100">
  //           Nội dung đề ({{ questions().length }} câu hỏi)
  //         </h2>
  //         <div
  //           class="flex items-center gap-1 rounded-xl border border-gray-200 bg-gray-100 p-1 text-sm font-bold dark:border-gray-700 dark:bg-gray-800"
  //           role="group"
  //           aria-label="Chế độ xem"
  //         >
  //           @for (m of modes; track m[0]) {
  //             <button
  //               type="button"
  //               (click)="viewMode.set(m[0])"
  //               [attr.aria-pressed]="viewMode() === m[0]"
  //               class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all"
  //               [class]="
  //                 viewMode() === m[0]
  //                   ? 'bg-white text-primary-800 shadow-xs dark:bg-gray-700 dark:text-sky-300'
  //                   : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100'
  //               "
  //             >
  //               <app-icon [name]="m[2]" svgClass="h-3.5 w-3.5" />
  //               <span>{{ m[1] }}</span>
  //             </button>
  //           }
  //         </div>
  //         <p class="text-base text-gray-700 dark:text-gray-300" role="status">
  //           Thang điểm: trắc nghiệm {{ scoring().mcqMax }} · tự luận {{ scoring().essayMax }}
  //           @if (scoring().essayMax > 0) {
  //             · {{ remaining().label }}
  //           }
  //         </p>
  //       </div>
  //       @if (errors()['_scoring']) {
  //         <p role="alert" class="text-sm font-medium text-red-700 dark:text-red-300">
  //           {{ errors()['_scoring'] }}
  //         </p>
  //       }
  //       @if (errors()['questions']) {
  //         <p role="alert" class="text-sm font-medium text-red-700 dark:text-red-300">
  //           {{ errors()['questions'] }}
  //         </p>
  //       }

  //       @if (viewMode() === 'preview') {
  //         <div class="space-y-4" aria-label="Xem như học sinh">
  //           @for (q of questions(); track q.id; let i = $index) {
  //             @if (
  //               i === 0 || (q.context ?? '').trim() !== (questions()[i - 1].context ?? '').trim()
  //             ) {
  //               @if (q.context) {
  //                 <div
  //                   class="rounded-xl border border-primary-200/70 bg-primary-50/50 p-4 text-base leading-relaxed text-gray-800 dark:border-sky-800 dark:bg-sky-900/30 dark:text-gray-100"
  //                 >
  //                   <app-formatted-text [text]="q.context" />
  //                 </div>
  //               }
  //             }
  //             <div
  //               class="space-y-3 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800"
  //             >
  //               <span
  //                 class="inline-flex rounded-lg bg-primary-700 px-2.5 py-1 text-sm font-bold text-white dark:bg-sky-400 dark:text-gray-900"
  //                 >Câu {{ i + 1 }}</span
  //               >
  //               @if (q.questionText) {
  //                 <div class="text-lg leading-relaxed text-gray-800 dark:text-gray-100">
  //                   <app-formatted-text [text]="q.questionText" />
  //                 </div>
  //               }
  //               @if (isEssay(q)) {
  //                 <p class="text-sm text-gray-500 dark:text-gray-400">
  //                   (Học sinh sẽ thấy ô nhập bài và nút tải lên 1 tệp ở đây)
  //                 </p>
  //               } @else {
  //                 <div class="grid grid-cols-1 gap-2.5">
  //                   @for (k of opts; track k) {
  //                     @if (q.options[k]) {
  //                       <div
  //                         class="flex min-h-[56px] items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 text-lg dark:border-gray-700 dark:bg-gray-800"
  //                       >
  //                         <span
  //                           class="flex h-9 w-9 flex-none items-center justify-center rounded border border-gray-300 bg-gray-100 text-base font-bold text-gray-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400"
  //                           >{{ k }}</span
  //                         >
  //                         <span class="flex-1 break-words"
  //                           ><app-formatted-text [text]="q.options[k]"
  //                         /></span>
  //                       </div>
  //                     }
  //                   }
  //                 </div>
  //               }
  //             </div>
  //           }
  //         </div>
  //       } @else {
  //         <fieldset [disabled]="readOnly()" class="space-y-4">
  //           @for (q of questions(); track q.id; let i = $index) {
  //             @let qe = errorsOf(q.id);
  //             <article
  //               class="space-y-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
  //               [attr.aria-label]="'Câu ' + (i + 1)"
  //             >
  //               <header class="flex flex-wrap items-center justify-between gap-2">
  //                 <h3 class="font-bold">
  //                   Câu {{ i + 1 }} · {{ isEssay(q) ? 'Tự luận' : 'Trắc nghiệm' }}
  //                 </h3>
  //                 <div class="flex flex-wrap gap-2">
  //                   <button
  //                     type="button"
  //                     class="btn-secondary"
  //                     [disabled]="i === 0"
  //                     (click)="move(i, -1)"
  //                     [attr.aria-label]="'Đưa câu ' + (i + 1) + ' lên'"
  //                   >
  //                     ↑
  //                   </button>
  //                   <button
  //                     type="button"
  //                     class="btn-secondary"
  //                     [disabled]="i === questions().length - 1"
  //                     (click)="move(i, 1)"
  //                     [attr.aria-label]="'Đưa câu ' + (i + 1) + ' xuống'"
  //                   >
  //                     ↓
  //                   </button>
  //                   <button
  //                     type="button"
  //                     class="btn-secondary"
  //                     (click)="insertAfter(i)"
  //                     title="Chèn thêm câu hỏi phía dưới"
  //                   >
  //                     <app-icon name="plus" svgClass="h-3.5 w-3.5" /> Chèn câu
  //                   </button>
  //                   <button type="button" class="btn-secondary" (click)="switchType(q)">
  //                     Đổi sang {{ isEssay(q) ? 'trắc nghiệm' : 'tự luận' }}
  //                   </button>
  //                   <button
  //                     type="button"
  //                     class="btn-danger"
  //                     (click)="remove(q.id)"
  //                     [attr.aria-label]="'Xóa câu ' + (i + 1)"
  //                   >
  //                     <!-- Haihs: icon cho nút giống bản gốc - start -->
  //                     <!-- đóng code cũ -->
  //                     <!-- Xóa -->
  //                     <app-icon name="trash-2" svgClass="h-4 w-4" /> Xóa
  //                     <!-- Haihs: icon cho nút giống bản gốc - end -->
  //                   </button>
  //                 </div>
  //               </header>

  //               @if (q.needsReview) {
  //                 <div
  //                   role="note"
  //                   class="rounded-lg bg-amber-50 p-3 text-base text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
  //                 >
  //                   {{ q.reviewReason || 'Cần xác nhận loại câu hỏi.' }}
  //                   <button
  //                     type="button"
  //                     class="ml-2 font-semibold underline"
  //                     (click)="patch(q.id, { needsReview: false, reviewReason: '' })"
  //                   >
  //                     Xác nhận
  //                   </button>
  //                 </div>
  //                 @if (qe['review']) {
  //                   <p role="alert" class="text-sm font-medium text-red-700 dark:text-red-300">
  //                     {{ qe['review'] }}
  //                   </p>
  //                 }
  //               }

  //               <label class="block text-base font-medium"
  //                 ><span
  //                   class="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-amber-900 dark:text-amber-300"
  //                   ><app-icon name="book-open" svgClass="h-3.5 w-3.5" />Dạng bài và ngữ cảnh bài
  //                   đọc</span
  //                 >
  //                 <textarea
  //                   placeholder="Nhập chỉ dẫn dạng bài / đoạn văn đọc hiểu dùng chung..."
  //                   [class]="area"
  //                   [value]="q.context"
  //                   (input)="text(q.id, 'context', $event)"
  //                 ></textarea>
  //               </label>
  //               <label class="block text-base font-medium"
  //                 >{{ isEssay(q) ? 'Đề bài' : 'Thân câu hỏi (để rỗng nếu là câu điền từ/phát âm):' }}
  //                 <textarea
  //                   [placeholder]="
  //                     isEssay(q)
  //                       ? 'Ví dụ: Write an email (80-100 words) to your friend about...'
  //                       : 'Ví dụ: When the church <u>was</u> first <u>establish</u> in 1973...'
  //                   "
  //                   [class]="area"
  //                   [value]="q.questionText"
  //                   (input)="text(q.id, 'questionText', $event)"
  //                 ></textarea>
  //               </label>
  //               @if (qe['text']) {
  //                 <p role="alert" class="text-sm font-medium text-red-700 dark:text-red-300">
  //                   {{ qe['text'] }}
  //                 </p>
  //               }

  //               @if (isEssay(q)) {
  //                 <label class="block text-base font-medium"
  //                   >Yêu cầu
  //                   <textarea
  //                     [class]="area"
  //                     [value]="q.requirements ?? ''"
  //                     (input)="text(q.id, 'requirements', $event)"
  //                   ></textarea>
  //                 </label>
  //                 <div class="space-y-2">
  //                   <label class="block text-base font-medium"
  //                     >Điểm của câu (bội số của 0,25)
  //                     <input
  //                       type="text"
  //                       inputmode="decimal"
  //                       class="input w-32"
  //                       [value]="q.maxScore ?? ''"
  //                       (input)="setScore(i, $event)"
  //                     />
  //                   </label>
  //                   @if (scoreError(i); as se) {
  //                     <p role="alert" class="text-sm font-medium text-red-700 dark:text-red-300">
  //                       {{ se }}
  //                     </p>
  //                   }
  //                   @if (qe['score']) {
  //                     <p role="alert" class="text-sm font-medium text-red-700 dark:text-red-300">
  //                       {{ qe['score'] }}
  //                     </p>
  //                   }
  //                   <h4 class="font-semibold">Tiêu chí chấm (tổng {{ sum(q) }})</h4>
  //                   @for (c of q.rubric ?? []; track c.key; let ci = $index) {
  //                     <div class="flex flex-wrap items-center gap-2">
  //                       <input
  //                         class="input flex-1"
  //                         [value]="c.label"
  //                         (input)="setCriterion(q, ci, 'label', $event)"
  //                         [attr.aria-label]="'Tên tiêu chí ' + (ci + 1)"
  //                       />
  //                       <input
  //                         type="text"
  //                         inputmode="decimal"
  //                         class="input w-24"
  //                         [value]="c.max"
  //                         (input)="setCriterion(q, ci, 'max', $event)"
  //                         [attr.aria-label]="'Điểm tiêu chí ' + (ci + 1)"
  //                       />
  //                       <button
  //                         type="button"
  //                         class="btn-secondary"
  //                         (click)="removeCriterion(q, ci)"
  //                         [attr.aria-label]="'Xóa tiêu chí ' + (ci + 1)"
  //                       >
  //                         <!-- Haihs: icon cho nút giống bản gốc - start -->
  //                         <!-- đóng code cũ -->
  //                         <!-- Xóa -->
  //                         <app-icon name="trash-2" svgClass="h-4 w-4" /> Xóa
  //                         <!-- Haihs: icon cho nút giống bản gốc - end -->
  //                       </button>
  //                     </div>
  //                     @if (qe['criteria:' + ci + ':label']) {
  //                       <p role="alert" class="text-sm font-medium text-red-700 dark:text-red-300">
  //                         {{ qe['criteria:' + ci + ':label'] }}
  //                       </p>
  //                     }
  //                     @if (qe['criteria:' + ci + ':max']) {
  //                       <p role="alert" class="text-sm font-medium text-red-700 dark:text-red-300">
  //                         {{ qe['criteria:' + ci + ':max'] }}
  //                       </p>
  //                     }
  //                   }
  //                   @if (qe['criteria']) {
  //                     <p role="alert" class="text-sm font-medium text-red-700 dark:text-red-300">
  //                       {{ qe['criteria'] }}
  //                     </p>
  //                   }
  //                   <button type="button" class="btn-secondary" (click)="addCriterion(q)">
  //                     <!-- Haihs: icon cho nút giống bản gốc - start -->
  //                     <!-- đóng code cũ -->
  //                     <!-- Thêm tiêu chí -->
  //                     <app-icon name="plus" svgClass="h-4 w-4" /> Thêm tiêu chí
  //                     <!-- Haihs: icon cho nút giống bản gốc - end -->
  //                   </button>
  //                 </div>
  //               } @else {
  //                 <div
  //                   class="space-y-2"
  //                   role="radiogroup"
  //                   [attr.aria-label]="'Đáp án đúng của câu ' + (i + 1)"
  //                 >
  //                   @for (k of opts; track k) {
  //                     <div class="flex items-center gap-2">
  //                       <input
  //                         type="radio"
  //                         [name]="'correct-' + q.id"
  //                         [checked]="q.correctAnswer === k"
  //                         (change)="patch(q.id, { correctAnswer: k })"
  //                         [attr.aria-label]="'Chọn ' + k + ' là đáp án đúng'"
  //                         title="Đặt làm đáp án đúng"
  //                       />
  //                       <span class="w-5 font-bold">{{ k }}</span>
  //                       <input
  //                         class="input flex-1"
  //                         [value]="q.options[k]"
  //                         (input)="setOption(q.id, k, $event)"
  //                         [attr.aria-label]="'Phương án ' + k + ' của câu ' + (i + 1)"
  //                       />
  //                     </div>
  //                   }
  //                   @if (qe['options']) {
  //                     <p role="alert" class="text-sm font-medium text-red-700 dark:text-red-300">
  //                       {{ qe['options'] }}
  //                     </p>
  //                   }
  //                   @if (qe['correct']) {
  //                     <p role="alert" class="text-sm font-medium text-red-700 dark:text-red-300">
  //                       {{ qe['correct'] }}
  //                     </p>
  //                   }
  //                 </div>
  //               }
  //               <label class="block text-base font-medium"
  //                 >Giải thích
  //                 <textarea
  //                   placeholder="Lời giải thích / Lý do chọn đáp án này..."
  //                   [class]="area"
  //                   [value]="q.explanation"
  //                   (input)="text(q.id, 'explanation', $event)"
  //                 ></textarea>
  //               </label>
  //               <details class="text-sm text-gray-600 dark:text-gray-400">
  //                 <summary class="cursor-pointer">Xem trước</summary>
  //                 <div class="mt-2 space-y-1">
  //                   <p><app-formatted-text [text]="q.context" /></p>
  //                   <p><app-formatted-text [text]="q.questionText" /></p>
  //                   @if (!isEssay(q)) {
  //                     @for (k of opts; track k) {
  //                       <p>{{ k }}. <app-formatted-text [text]="q.options[k]" /></p>
  //                     }
  //                   }
  //                 </div>
  //               </details>
  //             </article>
  //           }
  //         </fieldset>
  //       }

  //       @if (!readOnly() && viewMode() === 'edit') {
  //         <div class="flex flex-wrap gap-2">
  //           <button type="button" class="btn-secondary" (click)="addMcq()">
  //             <app-icon name="plus" svgClass="h-3.5 w-3.5" /> Thêm câu hỏi cuối đề
  //           </button>
  //           <button type="button" class="btn-secondary" (click)="addEssay()">Thêm câu tự luận</button>
  //         </div>
  //       }
  //     </section>
  //   `,
  template: `
    <section class="space-y-4" aria-label="Danh sách câu hỏi">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 class="text-lg font-bold text-gray-900 dark:text-gray-100">
          Nội dung đề ({{ questions().length }} câu hỏi)
        </h2>
        <div
          class="flex items-center gap-1 rounded-xl border border-gray-200 bg-gray-100 p-1 text-sm font-bold dark:border-gray-700 dark:bg-gray-800"
          role="group"
          aria-label="Chế độ xem"
        >
          @for (m of modes; track m[0]) {
            <button
              type="button"
              (click)="viewMode.set(m[0])"
              [attr.aria-pressed]="viewMode() === m[0]"
              class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all"
              [class]="
                viewMode() === m[0]
                  ? 'bg-white text-primary-800 shadow-xs dark:bg-gray-700 dark:text-sky-300'
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100'
              "
            >
              <app-icon [name]="m[2]" svgClass="h-3.5 w-3.5" />
              <span>{{ m[1] }}</span>
            </button>
          }
        </div>
        <p class="text-base text-gray-700 dark:text-gray-300" role="status">
          Thang điểm: trắc nghiệm {{ scoring().mcqMax }} · tự luận {{ scoring().essayMax }}
          @if (scoring().essayMax > 0) {
            · {{ remaining().label }}
          }
        </p>
      </div>
      @if (errors()['_scoring']) {
        <p role="alert" class="text-sm font-medium text-red-700 dark:text-red-300">
          {{ errors()['_scoring'] }}
        </p>
      }
      @if (errors()['questions']) {
        <p role="alert" class="text-sm font-medium text-red-700 dark:text-red-300">
          {{ errors()['questions'] }}
        </p>
      }

      <div class="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
        <div class="min-w-0 space-y-4 lg:col-span-8">
          @if (viewMode() === 'preview') {
            <div class="space-y-4" aria-label="Xem như học sinh">
              @for (q of questions(); track q.id; let i = $index) {
                @if (
                  i === 0 || (q.context ?? '').trim() !== (questions()[i - 1].context ?? '').trim()
                ) {
                  @if (q.context) {
                    <div
                      class="rounded-xl border border-primary-200/70 bg-primary-50/50 p-4 text-base leading-relaxed text-gray-800 dark:border-sky-800 dark:bg-sky-900/30 dark:text-gray-100"
                    >
                      <app-formatted-text [text]="q.context" />
                    </div>
                  }
                }
                <div
                  class="space-y-3 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800"
                >
                  <span
                    class="inline-flex rounded-lg bg-primary-700 px-2.5 py-1 text-sm font-bold text-white dark:bg-sky-400 dark:text-gray-900"
                    >Câu {{ i + 1 }}</span
                  >
                  @if (q.questionText) {
                    <div class="text-lg leading-relaxed text-gray-800 dark:text-gray-100">
                      <app-formatted-text [text]="q.questionText" />
                    </div>
                  }
                  @if (isEssay(q)) {
                    <p class="text-sm text-gray-500 dark:text-gray-400">
                      (Học sinh sẽ thấy ô nhập bài và nút tải lên 1 tệp ở đây)
                    </p>
                  } @else {
                    <div class="grid grid-cols-1 gap-2.5">
                      @for (k of opts; track k) {
                        @if (q.options[k]) {
                          <div
                            class="flex min-h-[56px] items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 text-lg dark:border-gray-700 dark:bg-gray-800"
                          >
                            <span
                              class="flex h-9 w-9 flex-none items-center justify-center rounded border border-gray-300 bg-gray-100 text-base font-bold text-gray-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400"
                              >{{ k }}</span
                            >
                            <span class="flex-1 break-words"
                              ><app-formatted-text [text]="q.options[k]"
                            /></span>
                          </div>
                        }
                      }
                    </div>
                  }
                </div>
              }
            </div>
          } @else {
            <fieldset [disabled]="readOnly()" class="space-y-4">
              @for (q of questions(); track q.id; let i = $index) {
                @let qe = errorsOf(q.id);
                <article
                  [id]="'editor-q-' + q.id"
                  class="scroll-mt-24 space-y-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
                  [attr.aria-label]="'Câu ' + (i + 1)"
                >
                  <header class="flex flex-wrap items-center justify-between gap-2">
                    <h3 class="font-bold">
                      Câu {{ i + 1 }} · {{ isEssay(q) ? 'Tự luận' : 'Trắc nghiệm' }}
                    </h3>
                    <div class="flex flex-wrap gap-2">
                      <button
                        type="button"
                        class="btn-secondary"
                        [disabled]="i === 0"
                        (click)="move(i, -1)"
                        [attr.aria-label]="'Đưa câu ' + (i + 1) + ' lên'"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        class="btn-secondary"
                        [disabled]="i === questions().length - 1"
                        (click)="move(i, 1)"
                        [attr.aria-label]="'Đưa câu ' + (i + 1) + ' xuống'"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        class="btn-secondary"
                        (click)="insertAfter(i)"
                        title="Chèn thêm câu hỏi phía dưới"
                      >
                        <app-icon name="plus" svgClass="h-3.5 w-3.5" /> Chèn câu
                      </button>
                      <button type="button" class="btn-secondary" (click)="switchType(q)">
                        Đổi sang {{ isEssay(q) ? 'trắc nghiệm' : 'tự luận' }}
                      </button>
                      <button
                        type="button"
                        class="btn-danger"
                        (click)="remove(q.id)"
                        [attr.aria-label]="'Xóa câu ' + (i + 1)"
                      >
                        <!-- Haihs: icon cho nút giống bản gốc - start -->
                        <!-- đóng code cũ -->
                        <!-- Xóa -->
                        <app-icon name="trash-2" svgClass="h-4 w-4" /> Xóa
                        <!-- Haihs: icon cho nút giống bản gốc - end -->
                      </button>
                    </div>
                  </header>

                  @if (q.needsReview) {
                    <div
                      role="note"
                      class="mb-3 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                    >
                      <app-icon
                        name="alert-circle"
                        class="mt-0.5 flex-none"
                        svgClass="h-4 w-4 text-amber-600 dark:text-amber-300"
                      />
                      <div class="flex-1">
                        <div class="font-bold">Cần xác nhận loại câu hỏi</div>
                        <div>
                          {{ q.reviewReason || 'AI chưa chắc câu này là trắc nghiệm hay tự luận.' }}
                        </div>
                      </div>
                      <div class="flex flex-none flex-col gap-1">
                        <button
                          type="button"
                          (click)="markEssay(q)"
                          class="rounded-lg bg-primary-700 px-2.5 py-1 font-bold text-white hover:bg-primary-800 dark:bg-sky-400 dark:text-gray-900 dark:hover:bg-sky-300"
                        >
                          Đây là tự luận
                        </button>
                        <button
                          type="button"
                          (click)="patch(q.id, { needsReview: false, reviewReason: '' })"
                          class="rounded-lg border border-amber-300 bg-white px-2.5 py-1 font-bold text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-gray-800 dark:text-amber-300 dark:hover:bg-amber-900/40"
                        >
                          Giữ trắc nghiệm
                        </button>
                      </div>
                    </div>
                    @if (qe['review']) {
                      <p role="alert" class="text-sm font-medium text-red-700 dark:text-red-300">
                        {{ qe['review'] }}
                      </p>
                    }
                  }

                  <label class="block text-base font-medium"
                    ><span
                      class="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-amber-900 dark:text-amber-300"
                      ><app-icon name="book-open" svgClass="h-3.5 w-3.5" />Dạng bài và ngữ cảnh bài
                      đọc</span
                    >
                    <textarea
                      placeholder="Nhập chỉ dẫn dạng bài / đoạn văn đọc hiểu dùng chung..."
                      [class]="area"
                      [value]="q.context"
                      (input)="text(q.id, 'context', $event)"
                    ></textarea>
                  </label>
                  <label class="block text-base font-medium"
                    ><span class="flex items-center justify-between"
                      >{{
                        isEssay(q) ? 'Đề bài' : 'Thân câu hỏi (để rỗng nếu là câu điền từ/phát âm):'
                      }}
                      @if (!isEssay(q)) {
                        <button
                          type="button"
                          (click)="underline(q.id, 'questionText')"
                          class="flex items-center gap-1 text-sm font-normal text-primary-700 hover:underline dark:text-sky-400"
                        >
                          + Thêm <u>gạch chân</u>
                        </button>
                      }
                    </span>
                    <textarea
                      [placeholder]="
                        isEssay(q)
                          ? 'Ví dụ: Write an email (80-100 words) to your friend about...'
                          : 'Ví dụ: When the church <u>was</u> first <u>establish</u> in 1973...'
                      "
                      [class]="area"
                      (select)="remember(q.id, 'questionText', $event)"
                      [value]="q.questionText"
                      (input)="text(q.id, 'questionText', $event)"
                    ></textarea>
                  </label>
                  @if (qe['text']) {
                    <p role="alert" class="text-sm font-medium text-red-700 dark:text-red-300">
                      {{ qe['text'] }}
                    </p>
                  }

                  @if (isEssay(q)) {
                    <label class="block text-base font-medium"
                      >Yêu cầu
                      <textarea
                        [class]="area"
                        [value]="q.requirements ?? ''"
                        (input)="text(q.id, 'requirements', $event)"
                      ></textarea>
                    </label>
                    <div class="space-y-2">
                      <label class="block text-base font-medium"
                        >Điểm của câu (bội số của 0,25)
                        <input
                          type="text"
                          inputmode="decimal"
                          class="input w-32"
                          [value]="q.maxScore ?? ''"
                          (input)="setScore(i, $event)"
                        />
                      </label>
                      @if (scoreError(i); as se) {
                        <p role="alert" class="text-sm font-medium text-red-700 dark:text-red-300">
                          {{ se }}
                        </p>
                      }
                      @if (qe['score']) {
                        <p role="alert" class="text-sm font-medium text-red-700 dark:text-red-300">
                          {{ qe['score'] }}
                        </p>
                      }
                      <h4 class="font-semibold">Tiêu chí chấm (tổng {{ sum(q) }})</h4>
                      @for (c of q.rubric ?? []; track c.key; let ci = $index) {
                        <div class="flex flex-wrap items-center gap-2">
                          <input
                            class="input flex-1"
                            [value]="c.label"
                            (input)="setCriterion(q, ci, 'label', $event)"
                            [attr.aria-label]="'Tên tiêu chí ' + (ci + 1)"
                          />
                          <input
                            type="text"
                            inputmode="decimal"
                            class="input w-24"
                            [value]="c.max"
                            (input)="setCriterion(q, ci, 'max', $event)"
                            [attr.aria-label]="'Điểm tiêu chí ' + (ci + 1)"
                          />
                          <button
                            type="button"
                            class="btn-secondary"
                            (click)="removeCriterion(q, ci)"
                            [attr.aria-label]="'Xóa tiêu chí ' + (ci + 1)"
                          >
                            <!-- Haihs: icon cho nút giống bản gốc - start -->
                            <!-- đóng code cũ -->
                            <!-- Xóa -->
                            <app-icon name="trash-2" svgClass="h-4 w-4" /> Xóa
                            <!-- Haihs: icon cho nút giống bản gốc - end -->
                          </button>
                        </div>
                        @if (qe['criteria:' + ci + ':label']) {
                          <p
                            role="alert"
                            class="text-sm font-medium text-red-700 dark:text-red-300"
                          >
                            {{ qe['criteria:' + ci + ':label'] }}
                          </p>
                        }
                        @if (qe['criteria:' + ci + ':max']) {
                          <p
                            role="alert"
                            class="text-sm font-medium text-red-700 dark:text-red-300"
                          >
                            {{ qe['criteria:' + ci + ':max'] }}
                          </p>
                        }
                      }
                      @if (qe['criteria']) {
                        <p role="alert" class="text-sm font-medium text-red-700 dark:text-red-300">
                          {{ qe['criteria'] }}
                        </p>
                      }
                      <button type="button" class="btn-secondary" (click)="addCriterion(q)">
                        <!-- Haihs: icon cho nút giống bản gốc - start -->
                        <!-- đóng code cũ -->
                        <!-- Thêm tiêu chí -->
                        <app-icon name="plus" svgClass="h-4 w-4" /> Thêm tiêu chí
                        <!-- Haihs: icon cho nút giống bản gốc - end -->
                      </button>
                    </div>
                  } @else {
                    <div
                      class="space-y-2"
                      role="radiogroup"
                      [attr.aria-label]="'Đáp án đúng của câu ' + (i + 1)"
                    >
                      @for (k of opts; track k) {
                        <div class="flex items-center gap-2">
                          <input
                            type="radio"
                            [name]="'correct-' + q.id"
                            [checked]="q.correctAnswer === k"
                            (change)="patch(q.id, { correctAnswer: k })"
                            [attr.aria-label]="'Chọn ' + k + ' là đáp án đúng'"
                            title="Đặt làm đáp án đúng"
                          />
                          <span class="w-5 font-bold">{{ k }}</span>
                          <button
                            type="button"
                            (click)="underline(q.id, k)"
                            title="Gạch chân phần đang bôi đen (hoặc cả đáp án)"
                            class="rounded px-1.5 text-sm font-semibold text-primary-700 hover:underline dark:text-sky-400"
                          >
                            <u>U</u>
                          </button>
                          <input
                            class="input flex-1"
                            [value]="q.options[k]"
                            (select)="remember(q.id, k, $event)"
                            (input)="setOption(q.id, k, $event)"
                            [attr.aria-label]="'Phương án ' + k + ' của câu ' + (i + 1)"
                          />
                        </div>
                      }
                      @if (qe['options']) {
                        <p role="alert" class="text-sm font-medium text-red-700 dark:text-red-300">
                          {{ qe['options'] }}
                        </p>
                      }
                      @if (qe['correct']) {
                        <p role="alert" class="text-sm font-medium text-red-700 dark:text-red-300">
                          {{ qe['correct'] }}
                        </p>
                      }
                    </div>
                  }
                  <label class="block text-base font-medium"
                    >Giải thích
                    <textarea
                      placeholder="Lời giải thích / Lý do chọn đáp án này..."
                      [class]="area"
                      [value]="q.explanation"
                      (input)="text(q.id, 'explanation', $event)"
                    ></textarea>
                  </label>
                  <details class="text-sm text-gray-600 dark:text-gray-400">
                    <summary class="cursor-pointer">Xem trước</summary>
                    <div class="mt-2 space-y-1">
                      <p><app-formatted-text [text]="q.context" /></p>
                      <p><app-formatted-text [text]="q.questionText" /></p>
                      @if (!isEssay(q)) {
                        @for (k of opts; track k) {
                          <p>{{ k }}. <app-formatted-text [text]="q.options[k]" /></p>
                        }
                      }
                    </div>
                  </details>
                </article>
              }
            </fieldset>
          }

          @if (!readOnly() && viewMode() === 'edit') {
            <div class="flex flex-wrap gap-2">
              <button type="button" class="btn-secondary" (click)="addMcq()">
                <app-icon name="plus" svgClass="h-3.5 w-3.5" /> Thêm câu hỏi cuối đề
              </button>
              <button type="button" class="btn-secondary" (click)="addEssay()">
                Thêm câu tự luận
              </button>
            </div>
          }
        </div>
        <aside
          class="sticky top-24 z-20 space-y-4 self-start lg:col-span-4"
          aria-label="Bảng đáp án và điều hướng"
        >
          <div
            class="space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-raised dark:border-gray-700 dark:bg-gray-800 dark:shadow-raised-dark"
          >
            <div
              class="flex items-center justify-between border-b border-gray-100 pb-3 dark:border-gray-700"
            >
              <div>
                <h3 class="text-base font-bold text-gray-900 dark:text-gray-100">
                  Bảng đáp án và điều hướng
                </h3>
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  Xem đáp án chuẩn hoặc nhảy nhanh đến câu
                </p>
              </div>
              <span
                class="badge border-primary-200 bg-primary-50 text-primary-800 dark:border-sky-800 dark:bg-sky-900/30 dark:text-sky-400"
                >{{ questions().length }} câu</span
              >
            </div>
            <div class="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
              @for (q of questions(); track q.id; let i = $index) {
                <div
                  class="flex items-center justify-between rounded-xl border border-gray-200 p-2 text-sm dark:border-gray-700"
                >
                  <button
                    type="button"
                    (click)="scrollTo(q.id)"
                    class="font-bold text-gray-800 hover:text-primary-700 dark:text-gray-100 dark:hover:text-sky-300"
                  >
                    Câu {{ i + 1 }}
                  </button>
                  @if (isEssay(q)) {
                    <span
                      class="badge border-primary-200 bg-primary-50 text-primary-800 dark:border-sky-800 dark:bg-sky-900/30 dark:text-sky-400"
                      >Tự luận • {{ q.maxScore ?? 0 }} điểm</span
                    >
                  } @else {
                    <div class="flex items-center gap-1">
                      @for (k of opts; track k) {
                        <button
                          type="button"
                          [disabled]="readOnly()"
                          (click)="patch(q.id, { correctAnswer: k })"
                          [attr.title]="'Đặt đáp án Câu ' + (i + 1) + ' là ' + k"
                          class="h-6 w-6 rounded-lg text-sm font-bold transition-all disabled:cursor-not-allowed"
                          [class]="
                            q.correctAnswer === k
                              ? 'scale-105 bg-green-600 text-white shadow-xs'
                              : 'bg-white text-gray-600 dark:bg-gray-800 dark:text-gray-300'
                          "
                        >
                          {{ k }}
                        </button>
                      }
                    </div>
                  }
                </div>
              }
            </div>
          </div>
        </aside>
      </div>
    </section>
  `,
  // Haihs: trình soạn có bảng đáp án và điều hướng, nút gạch chân, banner cần xác nhận loại câu như bản gốc - end
  // Haihs: trình soạn câu hỏi có chế độ Xem như học sinh, Chèn câu và nhãn như bản gốc - end
})
export class QuestionsEditor {
  /** Two-way: the parent owns the list. */
  readonly questions = model.required<EditorQuestion[]>();
  readonly errors = input<Record<string, string>>({});
  readonly readOnly = input(false);
  protected readonly opts = OPTS;
  protected readonly area = AREA;
  protected readonly isEssay = isEssay;
  protected readonly scoring = computed(() => computeScoringPreview(this.questions()));
  protected readonly remaining = computed(() =>
    remainingScore({
      essayMax: this.scoring().essayMax,
      hasMcq: this.questions().some((q) => !isEssay(q)),
    }),
  );

  protected errorsOf(id: number): Record<string, string> {
    return questionErrorsOf(this.errors(), id);
  }
  protected sum = (q: EditorQuestion): number => sumRubric(q.rubric);

  private nextId(): number {
    return this.questions().reduce((m, q) => Math.max(m, q.id), 0) + 1; // ids are never reused or renumbered
  }
  private update(fn: (list: EditorQuestion[]) => EditorQuestion[]): void {
    this.questions.set(fn(this.questions()));
  }
  protected patch(id: number, p: Partial<EditorQuestion>): void {
    this.update((l) => l.map((q) => (q.id === id ? { ...q, ...p } : q)));
  }
  protected text(
    id: number,
    field: 'context' | 'questionText' | 'explanation' | 'requirements',
    e: Event,
  ): void {
    this.patch(id, { [field]: (e.target as HTMLTextAreaElement).value });
  }
  protected setOption(id: number, k: OptionKey, e: Event): void {
    const value = (e.target as HTMLInputElement).value;
    this.update((l) =>
      l.map((q) => (q.id === id ? { ...q, options: { ...q.options, [k]: value } } : q)),
    );
  }
  protected addMcq(): void {
    this.update((l) => [...l, createMcqQuestion(this.nextId(), l.at(-1)?.context ?? '')]);
  }
  // Haihs: trình soạn câu hỏi có chế độ Xem như học sinh, Chèn câu và nhãn như bản gốc - start
  protected readonly viewMode = signal<'edit' | 'preview'>('edit');
  protected readonly modes: ['edit' | 'preview', string, string][] = [
    ['edit', 'Sửa trực tiếp', 'edit-3'],
    ['preview', 'Xem như học sinh', 'eye'],
  ];
  protected insertAfter(i: number): void {
    this.update((l) => {
      const next = [...l];
      next.splice(i + 1, 0, createMcqQuestion(this.nextId(), l[i]?.context ?? ''));
      return next;
    });
  }
  // Haihs: trình soạn câu hỏi có chế độ Xem như học sinh, Chèn câu và nhãn như bản gốc - end
  protected addEssay(): void {
    this.update((l) => [...l, createEssayQuestion(this.nextId())]);
  }
  protected remove(id: number): void {
    this.update((l) => l.filter((q) => q.id !== id));
  }
  protected move(i: number, d: number): void {
    this.update((l) => {
      const next = [...l];
      const j = i + d;
      if (j < 0 || j >= next.length) return l;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }
  // Haihs: trình soạn có bảng đáp án và điều hướng, nút gạch chân, banner cần xác nhận loại câu như bản gốc - start
  private selection: { id: number; field: string; start: number; end: number } | null = null;
  protected remember(id: number, field: string, e: Event): void {
    const el = e.target as HTMLInputElement | HTMLTextAreaElement;
    this.selection = { id, field, start: el.selectionStart ?? 0, end: el.selectionEnd ?? 0 };
  }
  /** Wraps the selected text in <u>...</u> (the whole field when nothing is selected); doing it again on an underlined part removes it. */
  protected underline(id: number, field: string): void {
    const q = this.questions().find((x) => x.id === id);
    if (!q) return;
    const isOpt = ['A', 'B', 'C', 'D'].includes(field);
    const current = isOpt ? (q.options[field as OptionKey] ?? '') : String(q.questionText ?? '');
    const sel = this.selection;
    const has = sel && sel.id === id && sel.field === field && sel.end > sel.start;
    const start = has ? sel.start : 0;
    const end = has ? sel.end : current.length;
    const target = current.slice(start, end);
    if (!target.trim()) return;
    const unwrapped = target.replace(/^<u>([\s\S]*)<\/u>$/i, '$1');
    const wrapped = unwrapped !== target ? unwrapped : `<u>${target}</u>`;
    const next = `${current.slice(0, start)}${wrapped}${current.slice(end)}`;
    this.update((l) =>
      l.map((x) =>
        x.id !== id
          ? x
          : isOpt
            ? { ...x, options: { ...x.options, [field]: next } }
            : { ...x, questionText: next },
      ),
    );
  }
  protected scrollTo(id: number): void {
    document
      .getElementById('editor-q-' + id)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  protected markEssay(q: EditorQuestion): void {
    const next = { ...convertQuestionType(q, 'essay'), needsReview: false, reviewReason: '' };
    this.update((l) => l.map((x) => (x.id === q.id ? next : x)));
  }
  // Haihs: trình soạn có bảng đáp án và điều hướng, nút gạch chân, banner cần xác nhận loại câu như bản gốc - end
  protected switchType(q: EditorQuestion): void {
    const next = convertQuestionType(q, isEssay(q) ? 'mcq' : 'essay');
    this.update((l) => l.map((x) => (x.id === q.id ? next : x)));
  }

  protected scoreError(i: number): string {
    const q = this.questions()[i];
    const hasMcq = this.questions().some((x) => !isEssay(x));
    return essayScoreError(q.maxScore, {
      limit: maxAllowedForQuestion({ questions: this.questions(), index: i }),
      strict: hasMcq,
    });
  }
  /** Changing the question points re-splits the criteria so their sum stays equal to it. */
  protected setScore(i: number, e: Event): void {
    const raw = (e.target as HTMLInputElement).value.replace(',', '.');
    const q = this.questions()[i];
    const r = redistributeCriteria(q.rubric, raw);
    this.patch(q.id, { maxScore: raw, ...(r.error ? {} : { rubric: r.criteria }) });
  }
  protected setCriterion(q: EditorQuestion, ci: number, field: 'label' | 'max', e: Event): void {
    const raw = (e.target as HTMLInputElement).value;
    const rubric = (q.rubric ?? []).map((c, idx) =>
      idx === ci ? { ...c, [field]: field === 'max' ? raw.replace(',', '.') : raw } : c,
    ) as RubricItem[];
    this.patch(q.id, { rubric, ...(field === 'max' ? { maxScore: sumRubric(rubric) } : {}) });
  }
  protected addCriterion(q: EditorQuestion): void {
    const rubric = [...(q.rubric ?? []), { key: nextRubricKey(q.rubric), label: '', max: 0.25 }];
    this.patch(q.id, { rubric, maxScore: sumRubric(rubric) });
  }
  protected removeCriterion(q: EditorQuestion, ci: number): void {
    const rubric = (q.rubric ?? []).filter((_, idx) => idx !== ci);
    this.patch(q.id, { rubric, maxScore: sumRubric(rubric) });
  }
}
