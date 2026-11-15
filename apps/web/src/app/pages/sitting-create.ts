// Created by Haihs on 12/11/2026
// <app-sitting-create> at /teacher/sittings/new: pick a template (?templateId=), classes, schedule, options and students. Port of SittingCreate.jsx.
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type {
  CandidateDto,
  ClassDto,
  SittingCreateBody,
  TemplateSummary,
} from '@doc-to-exam/contract';
import { Subscription, finalize, forkJoin } from 'rxjs';
import { ClassesApi, Paged } from '../core/classes.api';
import { SittingsApi } from '../core/sittings.api';
import { TemplatesApi } from '../core/templates.api';
import { AlertService } from '../shared/ui/alert.service';
import { FormField } from '../shared/ui/form-field';
import { Skeleton } from '../shared/ui/skeleton';
import { fetchAll } from '../shared/utils/fetch-all';
import { describeSittingError } from '../shared/utils/sitting-ui';
import { validateSittingForm } from '../shared/utils/sitting-form';
import { maskVnDateTime, parseVnDateTime } from '../shared/utils/vn-datetime';
import { Icon } from '../shared/ui/icon';

@Component({
  selector: 'app-sitting-create',
  // Haihs: khung báo lỗi có icon giống bản gốc - start
  // đóng code cũ
  // Haihs: mũi tên quay lại và tiêu đề có icon giống bản gốc - start
  // đóng code cũ
  // // imports: [RouterLink, FormField, Skeleton],
  // imports: [RouterLink, FormField, Skeleton, Icon],
  // Haihs: mũi tên quay lại và tiêu đề có icon giống bản gốc - end
  imports: [RouterLink, FormField, Skeleton, Icon],
  // Haihs: khung báo lỗi có icon giống bản gốc - end
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container-fluid space-y-6 py-8">
      <!-- Haihs: mũi tên quay lại và tiêu đề có icon giống bản gốc - start -->
      <!-- đóng code cũ -->
      <!-- class="text-base font-semibold text-primary-800 hover:underline dark:text-sky-400" -->
      <!-- >← Ca thi</a -->
      <a
        routerLink="/teacher/sittings"
        class="inline-flex items-center gap-1 text-base text-gray-600 hover:text-primary-700 dark:text-gray-400 dark:hover:text-sky-300"
        ><app-icon name="arrow-left" svgClass="h-4 w-4" /> Ca thi</a>
      <!-- Haihs: mũi tên quay lại và tiêu đề có icon giống bản gốc - end -->
      <h1 class="text-2xl font-extrabold text-gray-900 dark:text-gray-100">Tạo ca thi</h1>
      @if (loading()) {
        <app-skeleton variant="list" />
      } @else if (loadError()) {
        <!-- Haihs: khung báo lỗi có icon giống bản gốc - start -->
        <!-- đóng code cũ -->
        <!-- <div role="alert" class="text-base text-red-700 dark:text-red-400">{{ loadError() }}</div> -->
        <div
          role="alert"
          class="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-base text-red-700 dark:border-red-800 dark:bg-red-900/40 dark:text-red-300"
        >
          <app-icon name="alert-circle" class="mt-0.5 flex-none" svgClass="h-4 w-4" /><span>{{
            loadError()
          }}</span>
        </div>
        <!-- Haihs: khung báo lỗi có icon giống bản gốc - end -->
      } @else {
        <form (submit)="submit($event)" novalidate class="max-w-3xl space-y-5">
          <app-form-field label="Đề mẫu" [required]="true" [error]="errors()['templateId'] ?? ''">
            <select
              class="input"
              name="templateId"
              [value]="templateId()"
              (change)="pickTemplate($any($event.target).value)"
            >
              <option value="">— Chọn đề mẫu —</option>
              @for (t of templates(); track t.id) {
                <option [value]="t.id">{{ t.title }} ({{ t.totalQuestions }} câu)</option>
              }
            </select>
          </app-form-field>
          <app-form-field label="Tên ca thi" [required]="true" [error]="errors()['title'] ?? ''">
            <input
              class="input"
              name="title"
              maxlength="300"
              [value]="title()"
              (input)="title.set($any($event.target).value)"
            />
          </app-form-field>
          <app-form-field label="Mô tả" [error]="errors()['description'] ?? ''">
            <input
              class="input"
              name="description"
              maxlength="300"
              [value]="description()"
              (input)="description.set($any($event.target).value)"
            />
          </app-form-field>
          <div class="grid gap-4 sm:grid-cols-3">
            <app-form-field
              label="Giờ mở ca (dd/mm/yyyy hh:mm)"
              [required]="true"
              [error]="errors()['openAt'] ?? ''"
            >
              <input
                class="input"
                name="openAt"
                inputmode="numeric"
                placeholder="dd/mm/yyyy hh:mm"
                [value]="openAt()"
                (input)="openAt.set(mask($event))"
              />
            </app-form-field>
            <app-form-field
              label="Giờ đóng ca"
              [required]="true"
              [error]="errors()['closeAt'] ?? ''"
            >
              <input
                class="input"
                name="closeAt"
                inputmode="numeric"
                placeholder="dd/mm/yyyy hh:mm"
                [value]="closeAt()"
                (input)="closeAt.set(mask($event))"
              />
            </app-form-field>
            <app-form-field
              label="Thời gian làm bài (phút)"
              [required]="true"
              [error]="errors()['duration'] ?? ''"
            >
              <input
                class="input"
                name="duration"
                inputmode="numeric"
                [value]="duration()"
                (input)="duration.set($any($event.target).value)"
              />
            </app-form-field>
          </div>
          <label class="flex items-center gap-2 text-base"
            ><input
              type="checkbox"
              name="shuffle"
              [checked]="shuffle()"
              (change)="shuffle.set($any($event.target).checked)"
            />
            Đảo thứ tự câu hỏi</label
          >
          <label class="flex items-center gap-2 text-base"
            ><input
              type="checkbox"
              name="antiCheat"
              [checked]="antiCheat()"
              (change)="antiCheat.set($any($event.target).checked)"
            />
            Bật giám sát chuyển tab</label
          >

          <fieldset class="space-y-2">
            <legend class="text-base font-medium">
              Lớp tham gia <span aria-hidden="true" class="text-red-700"> *</span>
            </legend>
            @for (c of classes(); track c.id) {
              <label class="flex items-center gap-2 text-base">
                <input
                  type="checkbox"
                  [checked]="classIds().includes(c.id)"
                  (change)="toggleClass(c.id)"
                  [attr.aria-label]="'Lớp ' + c.name"
                />
                {{ c.name }} ({{ c.code }})
              </label>
            }
            @if (classes().length === 0) {
              <p class="text-base text-gray-600 dark:text-gray-400">
                Bạn chưa có lớp đang học nào.
              </p>
            }
            @if (errors()['classIds']) {
              <p role="alert" class="text-sm font-medium text-red-700 dark:text-red-300">
                {{ errors()['classIds'] }}
              </p>
            }
          </fieldset>

          <fieldset class="space-y-2">
            <legend class="text-base font-medium">Học sinh được vào ca</legend>
            <label class="flex items-center gap-2 text-base"
              ><input
                type="radio"
                name="mode"
                [checked]="mode() === 'all'"
                (change)="mode.set('all')"
              />
              Tất cả học sinh trong các lớp đã chọn</label
            >
            <label class="flex items-center gap-2 text-base"
              ><input type="radio" name="mode" [checked]="mode() === 'pick'" (change)="setPick()" />
              Chọn từng học sinh</label
            >
            @if (mode() === 'pick') {
              <input
                type="search"
                class="input sm:max-w-xs"
                aria-label="Tìm học sinh"
                placeholder="Tìm học sinh..."
                [value]="q()"
                (input)="onSearch($event)"
              />
              <ul class="max-h-64 space-y-1 overflow-y-auto">
                @for (s of candidates()?.items ?? []; track s.id) {
                  <li>
                    <label class="flex items-center gap-2 text-base"
                      ><input
                        type="checkbox"
                        [checked]="picked().has(s.id)"
                        (change)="togglePick(s.id)"
                      />
                      {{ s.fullName }}</label
                    >
                  </li>
                }
              </ul>
              <p class="text-sm text-gray-600 dark:text-gray-400">
                Đã chọn {{ picked().size }} học sinh.
              </p>
            }
          </fieldset>

          <button type="submit" class="btn-primary" [disabled]="busy()">
            {{ busy() ? 'Đang tạo...' : 'Tạo ca thi' }}
          </button>
        </form>
      }
    </div>
  `,
})
export class SittingCreate implements OnDestroy {
  private readonly api = inject(SittingsApi);
  private readonly templatesApi = inject(TemplatesApi);
  private readonly classesApi = inject(ClassesApi);
  private readonly alert = inject(AlertService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly templates = signal<TemplateSummary[]>([]);
  protected readonly classes = signal<ClassDto[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal('');
  protected readonly templateId = signal('');
  protected readonly title = signal('');
  protected readonly description = signal('');
  protected readonly openAt = signal('');
  protected readonly closeAt = signal('');
  protected readonly duration = signal('45');
  protected readonly shuffle = signal(false);
  protected readonly antiCheat = signal(false);
  protected readonly classIds = signal<string[]>([]);
  protected readonly mode = signal<'all' | 'pick'>('all');
  protected readonly picked = signal<Set<string>>(new Set());
  protected readonly q = signal('');
  protected readonly candidates = signal<Paged<CandidateDto> | null>(null);
  protected readonly errors = signal<Record<string, string>>({});
  protected readonly busy = signal(false);
  protected readonly mask = (e: Event) => maskVnDateTime((e.target as HTMLInputElement).value);
  private sub?: Subscription;
  private candSub?: Subscription;
  private timer?: ReturnType<typeof setTimeout>;
  private readonly selected = computed(() =>
    this.templates().find((t) => t.id === this.templateId()),
  );

  constructor() {
    this.sub = forkJoin([
      fetchAll((p) => this.templatesApi.list({ view: 'active', page: p, limit: 100 })),
      fetchAll((p) => this.classesApi.list({ view: 'active', page: p, limit: 50 })),
    ]).subscribe({
      next: ([templates, classes]) => {
        this.templates.set(templates);
        this.classes.set(classes);
        const wanted = this.route.snapshot.queryParamMap.get('templateId');
        if (wanted && templates.some((t) => t.id === wanted)) this.pickTemplate(wanted);
        this.loading.set(false);
      },
      error: (e: unknown) => {
        this.loadError.set(describeSittingError(e, 'Không tải được đề mẫu hoặc lớp.'));
        this.loading.set(false);
      },
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.candSub?.unsubscribe();
    clearTimeout(this.timer);
  }

  protected pickTemplate(id: string): void {
    this.templateId.set(id);
    const t = this.selected();
    if (t && !this.title()) this.title.set(t.title);
    if (t && !this.description()) this.description.set(t.description);
  }
  protected toggleClass(id: string): void {
    this.classIds.update((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));
    if (this.mode() === 'pick') this.loadCandidates();
  }
  protected setPick(): void {
    this.mode.set('pick');
    this.loadCandidates();
  }
  protected togglePick(id: string): void {
    this.picked.update((s) => {
      const next = new Set(s);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }
  protected onSearch(e: Event): void {
    this.q.set((e.target as HTMLInputElement).value);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.loadCandidates(), 300);
  }
  /** Latest wins. */
  private loadCandidates(): void {
    this.candSub?.unsubscribe();
    if (this.classIds().length === 0) return void this.candidates.set(null);
    this.candSub = this.api
      .candidates(this.classIds(), { q: this.q().trim() || undefined })
      .subscribe({
        next: (r) => this.candidates.set(r),
        error: (e: unknown) =>
          void this.alert.error(describeSittingError(e, 'Không tải được danh sách học sinh.')),
      });
  }

  protected submit(e: Event): void {
    e.preventDefault();
    if (this.busy()) return; // single-flight
    const errs = validateSittingForm({
      templateId: this.templateId(),
      title: this.title(),
      description: this.description(),
      openAt: this.openAt(),
      closeAt: this.closeAt(),
      duration: this.duration(),
      classIds: this.classIds(),
      requireTemplate: true,
      requireFutureClose: true,
    });
    this.errors.set(errs);
    const first = Object.values(errs)[0];
    if (first) return void this.alert.error(first);
    const body: SittingCreateBody = {
      templateId: this.templateId(),
      title: this.title().trim(),
      description: this.description().trim(),
      openAt: (parseVnDateTime(this.openAt()) as Date).toISOString(),
      closeAt: (parseVnDateTime(this.closeAt()) as Date).toISOString(),
      durationMinutes: Number(this.duration()),
      shuffleQuestions: this.shuffle(),
      antiCheat: this.antiCheat(),
      classIds: this.classIds(),
      ...(this.mode() === 'all'
        ? { allInClasses: true, excludeStudentIds: [] }
        : { studentIds: [...this.picked()] }),
    };
    this.busy.set(true);
    this.api
      .create(body)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: (r) =>
          void this.alert
            .success('Đã tạo ca thi.')
            .then(() => this.router.navigate(['/teacher/sittings', r.id])),
        error: (err: unknown) => {
          const msg = describeSittingError(err, 'Không tạo được ca thi.');
          if ((err as { code?: string }).code === 'SITTING_TITLE_TAKEN')
            this.errors.update((m) => ({ ...m, title: msg }));
          void this.alert.error(msg);
        },
      });
  }
}
