// Created by Haihs on 12/11/2026
// <app-sitting-results-panel>: results table with filters, stats, not-submitted list, publication card and exports (CSV / XLSX). Port of SittingResultsPanel.jsx + ResultsPublishCard.jsx (compact).
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import type { QuestionDto } from '@doc-to-exam/contract';
import { Subscription, firstValueFrom } from 'rxjs';
import {
  GradingProgress,
  Publication,
  ResultsData,
  SittingsApi,
  SubmissionRow,
} from '../../core/sittings.api';
import { downloadTextFile, safeFileName } from '../utils/browser';
import { buildCsv } from '../utils/csv';
import { formatTimeSecondsDate } from '../utils/date-format';
import { describeSittingError } from '../utils/sitting-ui';
import { AlertService } from './alert.service';
import { ConfirmService } from './confirm-modal';
import { Pager } from './pager';
import { SittingSubmissionModal } from './sitting-submission-modal';
import { Skeleton } from './skeleton';
import { Icon } from './icon';

const PAGE_SIZE = 50;

@Component({
  selector: 'app-sitting-results-panel',
  // Haihs: icon cho nút giống bản gốc - start
  // đóng code cũ
  // imports: [Pager, SittingSubmissionModal, Skeleton],
  imports: [Pager, SittingSubmissionModal, Skeleton, Icon],
  // Haihs: icon cho nút giống bản gốc - end
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="space-y-5" aria-label="Kết quả ca thi">
      @if (pub(); as p) {
        <div
          class="space-y-2 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
          role="region"
          aria-label="Công bố kết quả"
        >
          <h2 class="text-lg font-bold">Công bố kết quả</h2>
          <p class="text-base">
            {{ p.submittedCount }} bài nộp · {{ p.readyCount }} sẵn sàng ·
            {{ p.ungradedCount }} chưa chấm xong · {{ p.notSubmittedCount }} chưa nộp
            @if (p.staleCount > 0) {
              · {{ p.staleCount }} cần chấm lại
            }
          </p>
          @if (p.leak.otherOpenSittings > 0) {
            <p role="note" class="text-base text-amber-800 dark:text-amber-300">
              Còn {{ p.leak.otherOpenSittings }} ca khác dùng cùng đề mẫu chưa đóng: công bố có thể
              làm lộ đáp án ({{ leakTitles(p) }}).
            </p>
          }
          @if (p.publishedAt) {
            <p class="text-base font-semibold text-green-700 dark:text-green-300">
              Đã công bố lúc {{ fmt(p.publishedAt) }}.
            </p>
            <button type="button" class="btn-danger" [disabled]="busy()" (click)="unpublish()">
              Thu hồi công bố
            </button>
          } @else {
            <button
              type="button"
              class="btn-primary"
              [disabled]="busy() || !p.canPublish"
              (click)="publish()"
            >
              <!-- Haihs: icon cho nút giống bản gốc - start -->
              <!-- đóng code cũ -->
              <!-- Công bố kết quả -->
              <app-icon name="megaphone" svgClass="h-4 w-4" /> Công bố kết quả
              <!-- Haihs: icon cho nút giống bản gốc - end -->
            </button>
            @if (!p.canPublish) {
              <p class="text-sm text-gray-600 dark:text-gray-400">
                Chưa công bố được: còn bài tự luận chưa chấm xong.
              </p>
            }
          }
        </div>
      }
      @if (progress(); as g) {
        <p class="text-base text-gray-700 dark:text-gray-300">
          Tự luận: đã chấm {{ g.finished }}/{{ g.essaySubmissions }} bài{{
            g.staleCount > 0 ? ', ' + g.staleCount + ' bài cần chấm lại' : ''
          }}.
        </p>
      }

      <div class="flex flex-wrap items-center gap-3">
        <label class="text-base font-medium"
          >Lớp
          <select
            class="input ml-2 w-auto"
            [value]="classId()"
            (change)="setFilter('classId', $any($event.target).value)"
          >
            <option value="">Tất cả</option>
            @for (c of data()?.classes ?? []; track c.id) {
              <option [value]="c.id">{{ c.name }}</option>
            }
          </select>
        </label>
        <label class="text-base font-medium"
          >Trạng thái
          <select
            class="input ml-2 w-auto"
            [value]="status()"
            (change)="setFilter('status', $any($event.target).value)"
          >
            <option value="">Tất cả</option>
            <option value="pending">Chờ chấm</option>
            <option value="done">Đã chấm</option>
            <option value="stale">Cần chấm lại</option>
            <option value="cheat">Có vi phạm</option>
            <option value="auto">Tự động nộp</option>
            <option value="not_submitted">Chưa nộp</option>
          </select>
        </label>
        <label class="text-base font-medium"
          >Sắp theo
          <select
            class="input ml-2 w-auto"
            [value]="sort()"
            (change)="setFilter('sort', $any($event.target).value)"
          >
            <option value="name">Tên</option>
            <option value="correct">Số câu đúng</option>
            <option value="wrong">Số câu sai</option>
          </select>
        </label>
        <input
          type="search"
          class="input sm:max-w-xs"
          aria-label="Tìm học sinh"
          placeholder="Tìm học sinh..."
          [value]="search()"
          (input)="onSearch($event)"
        />
        <label class="flex items-center gap-2 text-base"
          ><input
            type="checkbox"
            [checked]="includeTeacher()"
            (change)="setFilter('includeTeacher', $any($event.target).checked ? '1' : '')"
          />
          Gồm bài làm thử của giáo viên</label
        >
      </div>
      <div class="flex flex-wrap gap-2">
        <button type="button" class="btn-secondary" [disabled]="busy()" (click)="exportCsv()">
          Xuất CSV
        </button>
        <button type="button" class="btn-secondary" [disabled]="busy()" (click)="exportXlsx()">
          Xuất Excel
        </button>
      </div>

      @if (loadError()) {
        <div role="alert" class="text-base text-red-700 dark:text-red-400">
          {{ loadError() }}
          <button type="button" class="ml-2 font-semibold underline" (click)="load()">
            Thử lại
          </button>
        </div>
      }
      @if (loading()) {
        <app-skeleton variant="list" />
      } @else if (data(); as d) {
        <p class="text-base" role="status">
          {{ d.stats.totalSubmissions }} bài nộp · trung bình {{ d.stats.avgScore }} · cao nhất
          {{ d.stats.maxScore }} · thấp nhất {{ d.stats.minScore }}
        </p>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-base">
            <caption class="sr-only">
              Bài nộp của ca thi
            </caption>
            <thead>
              <tr>
                <th scope="col" class="p-2">Họ và tên</th>
                <th scope="col" class="p-2">Lớp</th>
                <th scope="col" class="p-2">Đúng/Tổng</th>
                <th scope="col" class="p-2">Điểm</th>
                <th scope="col" class="p-2">Vi phạm</th>
                <th scope="col" class="p-2">Nộp lúc</th>
                <th scope="col" class="p-2"><span class="sr-only">Thao tác</span></th>
              </tr>
            </thead>
            <tbody>
              @for (s of d.submissions; track s._id) {
                <tr class="border-t border-gray-200 dark:border-gray-700">
                  <td class="p-2 font-semibold">
                    {{ s.studentName || '(tài khoản đã xóa)' }}{{ s.byTeacher ? ' (thi thử)' : '' }}
                  </td>
                  <td class="p-2">{{ s.classNames.join(', ') }}</td>
                  <td class="p-2">{{ s.correctCount }}/{{ s.totalQuestions }}</td>
                  <td class="p-2">
                    {{ s.totalScore === null ? s.gradingLabel : s.totalScore + '/' + s.maxScore
                    }}{{ s.essayStale ? ' · cần chấm lại' : '' }}
                  </td>
                  <td class="p-2">{{ s.violationCount }}</td>
                  <td class="p-2">
                    {{ fmt(s.submittedAt) }}{{ s.isAutoSubmitted ? ' (tự động)' : '' }}
                  </td>
                  <td class="p-2">
                    <button
                      type="button"
                      class="btn-secondary"
                      (click)="open.set(s)"
                      [attr.aria-label]="'Xem bài của ' + s.studentName"
                    >
                      Xem / Chấm
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        @if (d.submissions.length === 0) {
          <p class="text-base text-gray-600 dark:text-gray-400">Chưa có bài nộp phù hợp.</p>
        }
        <app-pager
          [page]="d.pagination.page"
          [totalPages]="d.pagination.totalPages"
          [total]="d.pagination.total"
          unit="bài"
          (pageChange)="goPage($event)"
        />
        @if (d.notSubmitted.length > 0) {
          <section aria-label="Chưa nộp bài">
            <h3 class="font-bold">Chưa nộp ({{ d.notSubmittedPagination.total }})</h3>
            <ul class="space-y-1 text-base">
              @for (n of d.notSubmitted; track n.studentId) {
                <li>
                  {{ n.studentName }}{{ n.phoneNumber ? ' · ' + n.phoneNumber : ''
                  }}{{ n.hasSession ? ' · đã vào chưa nộp' : ''
                  }}{{ n.inClass ? '' : ' · không còn trong lớp' }}
                </li>
              }
            </ul>
          </section>
        }
      }
    </section>
    @if (open(); as s) {
      <app-sitting-submission-modal
        [sittingId]="sittingId()"
        [s]="s"
        [questions]="questions()"
        (closed)="open.set(null)"
        (changed)="reload()"
      />
    }
  `,
})
export class SittingResultsPanel implements OnDestroy {
  readonly sittingId = input.required<string>();
  private readonly api = inject(SittingsApi);
  private readonly alert = inject(AlertService);
  private readonly confirm = inject(ConfirmService);
  protected readonly fmt = formatTimeSecondsDate;
  protected readonly data = signal<ResultsData | null>(null);
  protected readonly pub = signal<Publication | null>(null);
  protected readonly progress = signal<GradingProgress | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadError = signal('');
  protected readonly busy = signal(false);
  protected readonly open = signal<SubmissionRow | null>(null);
  protected readonly classId = signal('');
  protected readonly status = signal('');
  protected readonly sort = signal('name');
  protected readonly search = signal('');
  protected readonly includeTeacher = signal(false);
  private readonly page = signal(1);
  protected readonly questions = computed<QuestionDto[]>(() => this.data()?.exam.questions ?? []);
  private sub?: Subscription;
  private timer?: ReturnType<typeof setTimeout>;
  private applied = '';

  constructor() {
    queueMicrotask(() => this.reload());
  }
  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    clearTimeout(this.timer);
  }

  protected leakTitles(p: Publication): string {
    return p.leak.items.map((i) => i.title).join(', ');
  }

  protected reload(): void {
    this.load();
    this.api
      .publication(this.sittingId())
      .subscribe({ next: (p) => this.pub.set(p), error: () => this.pub.set(null) });
    this.api
      .gradingProgress(this.sittingId())
      .subscribe({ next: (g) => this.progress.set(g), error: () => this.progress.set(null) });
  }

  /** Latest wins. */
  protected load(): void {
    this.sub?.unsubscribe();
    this.loading.set(true);
    this.loadError.set('');
    this.sub = this.api
      .results(this.sittingId(), {
        page: this.page(),
        limit: PAGE_SIZE,
        classId: this.classId() || undefined,
        status: this.status() || undefined,
        sort: this.sort(),
        search: this.applied || undefined,
        includeTeacher: this.includeTeacher() ? '1' : undefined,
      })
      .subscribe({
        next: (r) => {
          this.data.set(r);
          this.loading.set(false);
        },
        error: (e: unknown) => {
          this.loadError.set(describeSittingError(e, 'Không tải được kết quả.'));
          this.loading.set(false);
        },
      });
  }
  protected setFilter(key: 'classId' | 'status' | 'sort' | 'includeTeacher', v: string): void {
    if (key === 'includeTeacher') this.includeTeacher.set(v === '1');
    else this[key].set(v);
    this.page.set(1);
    this.load();
  }
  protected onSearch(e: Event): void {
    const v = (e.target as HTMLInputElement).value;
    this.search.set(v);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.applied = v.trim();
      this.page.set(1);
      this.load();
    }, 300);
  }
  protected goPage(p: number): void {
    this.page.set(p);
    this.load();
  }

  private async run(op: () => Promise<unknown>, ok: string, fallback: string): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      await op();
      if (ok) void this.alert.success(ok);
      this.reload();
    } catch (e) {
      void this.alert.error(describeSittingError(e, fallback));
    } finally {
      this.busy.set(false);
    }
  }
  protected async publish(): Promise<void> {
    const ok = await this.confirm.confirm(
      'Học sinh sẽ xem được điểm của mình ngay sau khi công bố.',
      { title: 'Công bố kết quả?', confirmText: 'Công bố', cancelText: 'Hủy' },
    );
    if (ok)
      await this.run(
        () => firstValueFrom(this.api.publish(this.sittingId())),
        'Đã công bố kết quả.',
        'Không công bố được.',
      );
  }
  protected async unpublish(): Promise<void> {
    const ok = await this.confirm.confirm('Học sinh sẽ không xem được điểm nữa.', {
      title: 'Thu hồi công bố?',
      confirmText: 'Thu hồi',
      cancelText: 'Hủy',
      danger: true,
    });
    if (ok)
      await this.run(
        () => firstValueFrom(this.api.unpublish(this.sittingId())),
        'Đã thu hồi công bố.',
        'Không thu hồi được.',
      );
  }

  protected async exportXlsx(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      const blob = await firstValueFrom(
        this.api.exportXlsx(this.sittingId(), this.classId() || undefined),
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${safeFileName(this.data()?.exam.title ?? 'ca-thi')}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      void this.alert.error(
        describeSittingError(e, 'Không xuất được file Excel (ca quá lớn thì hãy lọc theo lớp).'),
      );
    } finally {
      this.busy.set(false);
    }
  }

  /** CSV built in the browser from the JSON export (cells are formula-injection safe through buildCsv). */
  protected async exportCsv(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      const r = (await firstValueFrom(
        this.api.exportJson(this.sittingId(), this.classId() || undefined),
      )) as {
        exam: { title: string };
        submissions: {
          studentName: string;
          classNames: string[];
          correctCount: number;
          totalQuestions: number;
          totalScore: number | null;
          gradingLabel: string;
          violationCount: number;
          submittedAt: string;
        }[];
        notSubmitted: { studentName: string }[];
      };
      const rows = [
        ...r.submissions.map((s, i) => [
          i + 1,
          s.studentName,
          s.classNames.join(', '),
          s.correctCount,
          s.totalQuestions,
          s.totalScore ?? s.gradingLabel,
          s.violationCount,
          formatTimeSecondsDate(s.submittedAt),
        ]),
        ...r.notSubmitted.map((n, i) => [
          r.submissions.length + i + 1,
          n.studentName,
          '',
          '',
          '',
          'Chưa nộp',
          '',
          '',
        ]),
      ];
      downloadTextFile(
        `${safeFileName(r.exam.title)}.csv`,
        buildCsv(
          [
            'STT',
            'Họ và tên',
            'Lớp',
            'Số câu đúng',
            'Tổng số câu',
            'Điểm',
            'Số vi phạm',
            'Thời gian nộp',
          ],
          rows,
        ),
      );
    } catch (e) {
      void this.alert.error(describeSittingError(e, 'Không xuất được file CSV.'));
    } finally {
      this.busy.set(false);
    }
  }
}
