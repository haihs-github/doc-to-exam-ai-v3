// Created by Haihs on 12/11/2026
// <app-class-teachers-tab>: teachers of a class (list, approve, remove) and add by name/phone search. Port of ClassTeachersTab.jsx.
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
import type { ClassMemberDto } from '@doc-to-exam/contract';
import { Observable, Subscription, finalize } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { ClassesApi, Paged } from '../../core/classes.api';
import { describeClassError } from '../utils/class-ui';
import { AlertService } from './alert.service';
import { ConfirmService } from './confirm-modal';
import { Skeleton } from './skeleton';
import { Icon } from './icon';
import { SearchSelect } from './search-select';

type Found = ClassMemberDto & { alreadyMember?: boolean };
const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_MIN = 3;

@Component({
  selector: 'app-class-teachers-tab',
  // Haihs: icon cho nút giống bản gốc - start
  // đóng code cũ
  // Haihs: khung báo lỗi có icon giống bản gốc - start
  // đóng code cũ
  // // imports: [Skeleton],
  // imports: [Skeleton, Icon],
  // Haihs: khung báo lỗi có icon giống bản gốc - end
  // Haihs: SearchSelect có chế độ tìm phía server, ô thêm giáo viên dùng nó như bản gốc - start
  // đóng code cũ
  // imports: [Skeleton, Icon],
  imports: [Skeleton, Icon, SearchSelect],
  // Haihs: SearchSelect có chế độ tìm phía server, ô thêm giáo viên dùng nó như bản gốc - end
  // Haihs: icon cho nút giống bản gốc - end
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Haihs: SearchSelect có chế độ tìm phía server, ô thêm giáo viên dùng nó như bản gốc - start
  // đóng code cũ
  //   template: `
  //     <section class="space-y-6" aria-label="Giáo viên của lớp">
  //       <div class="space-y-3">
  //         <label
  //           for="teacher-search"
  //           class="block text-base font-medium text-gray-800 dark:text-gray-200"
  //           >Thêm giáo viên (tên hoặc số điện thoại, ít nhất 3 ký tự)</label
  //         >
  //         <input
  //           id="teacher-search"
  //           type="search"
  //           name="teacherSearch"
  //           class="input sm:max-w-md"
  //           maxlength="50"
  //           autocomplete="off"
  //           [value]="q()"
  //           (input)="onSearch($event)"
  //         />
  //         @if (searchError()) {
  //           <p role="alert" class="text-sm font-medium text-red-700 dark:text-red-300">
  //             {{ searchError() }}
  //           </p>
  //         }
  //         @if (found(); as f) {
  //           @if (f.items.length === 0) {
  //             <p class="text-base text-gray-600 dark:text-gray-400">
  //               Không tìm thấy giáo viên phù hợp.
  //             </p>
  //           }
  //           <ul class="space-y-2">
  //             @for (u of f.items; track u.userId) {
  //               <li
  //                 class="flex items-center justify-between gap-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700"
  //               >
  //                 <span class="min-w-0"
  //                   ><span class="font-semibold">{{ u.fullName }}</span>
  //                   <span class="text-gray-600 dark:text-gray-400"> · {{ u.phoneNumber }}</span></span
  //                 >
  //                 <button
  //                   type="button"
  //                   class="btn-secondary"
  //                   [disabled]="busy() || u.alreadyMember"
  //                   (click)="add(u)"
  //                 >
  //                   {{ u.alreadyMember ? 'Đã trong lớp' : 'Thêm' }}
  //                 </button>
  //               </li>
  //             }
  //           </ul>
  //         }
  //       </div>

  //       @if (loadError()) {
  //         <!-- Haihs: khung báo lỗi có icon giống bản gốc - start -->
  //         <!-- đóng code cũ -->
  //         <!-- <div role="alert" class="text-base text-red-700 dark:text-red-400"> -->
  //         <!-- {{ loadError() }} -->
  //         <!-- <button type="button" class="ml-2 font-semibold underline" (click)="load()"> -->
  //         <div
  //           role="alert"
  //           class="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-base text-red-700 dark:border-red-800 dark:bg-red-900/40 dark:text-red-300"
  //         >
  //           <app-icon name="alert-circle" class="mt-0.5 flex-none" svgClass="h-4 w-4" />
  //           <span>{{ loadError() }}</span>
  //           <button type="button" class="ml-auto font-semibold underline" (click)="load()">
  //             <!-- Haihs: khung báo lỗi có icon giống bản gốc - end -->
  //             Thử lại
  //           </button>
  //         </div>
  //       }
  //       @if (loading()) {
  //         <app-skeleton variant="list" />
  //       } @else {
  //         <ul class="space-y-2">
  //           @for (t of teachers(); track t.userId) {
  //             <li
  //               class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
  //             >
  //               <span class="min-w-0"
  //                 ><span class="font-bold">{{ t.fullName }}</span>
  //                 <span class="text-gray-600 dark:text-gray-400"> · {{ t.phoneNumber }}</span></span
  //               >
  //               <span class="flex items-center gap-2">
  //                 @if (t.status === 'pending') {
  //                   <span
  //                     class="badge border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
  //                     >Chờ duyệt</span
  //                   >
  //                   <button
  //                     type="button"
  //                     class="btn-primary"
  //                     [disabled]="busy()"
  //                     (click)="approve(t)"
  //                   >
  //                     <!-- Haihs: icon cho nút giống bản gốc - start -->
  //                     <!-- đóng code cũ -->
  //                     <!-- Duyệt -->
  //                     <app-icon name="check" svgClass="h-4 w-4" /> Duyệt
  //                     <!-- Haihs: icon cho nút giống bản gốc - end -->
  //                   </button>
  //                 }
  //                 @if (t.userId !== me()) {
  //                   <button
  //                     type="button"
  //                     class="btn-danger"
  //                     [disabled]="busy()"
  //                     [attr.aria-label]="'Gỡ giáo viên ' + t.fullName"
  //                     (click)="remove(t)"
  //                   >
  //                     <!-- Haihs: icon cho nút giống bản gốc - start -->
  //                     <!-- đóng code cũ -->
  //                     <!-- Gỡ -->
  //                     <app-icon name="user-minus" svgClass="h-4 w-4" /> Gỡ
  //                     <!-- Haihs: icon cho nút giống bản gốc - end -->
  //                   </button>
  //                 }
  //               </span>
  //             </li>
  //           }
  //         </ul>
  //       }
  //     </section>
  //   `,
  template: `
    <section class="space-y-6" aria-label="Giáo viên của lớp">
      <div class="space-y-3">
        <label
          for="teacher-search"
          class="block text-base font-medium text-gray-800 dark:text-gray-200"
          >Thêm giáo viên bằng tên hoặc số điện thoại</label
        >
        <app-search-select
          class="sm:max-w-md"
          label="Tìm giáo viên theo tên hoặc số điện thoại"
          placeholder="Nhập tên hoặc ít nhất 3 chữ số điện thoại"
          emptyText="Không tìm thấy giáo viên phù hợp"
          [remote]="true"
          [minChars]="3"
          [error]="searchError()"
          [options]="teacherOptions()"
          [disabledKeys]="memberKeys()"
          (queryChange)="search($event)"
          (picked)="addById($event)"
        />
      </div>

      @if (loadError()) {
        <!-- Haihs: khung báo lỗi có icon giống bản gốc - start -->
        <!-- đóng code cũ -->
        <!-- <div role="alert" class="text-base text-red-700 dark:text-red-400"> -->
        <!-- {{ loadError() }} -->
        <!-- <button type="button" class="ml-2 font-semibold underline" (click)="load()"> -->
        <div
          role="alert"
          class="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-base text-red-700 dark:border-red-800 dark:bg-red-900/40 dark:text-red-300"
        >
          <app-icon name="alert-circle" class="mt-0.5 flex-none" svgClass="h-4 w-4" />
          <span>{{ loadError() }}</span>
          <button type="button" class="ml-auto font-semibold underline" (click)="load()">
            <!-- Haihs: khung báo lỗi có icon giống bản gốc - end -->
            Thử lại
          </button>
        </div>
      }
      @if (loading()) {
        <app-skeleton variant="list" />
      } @else {
        <ul class="space-y-2">
          @for (t of teachers(); track t.userId) {
            <li
              class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
            >
              <span class="min-w-0"
                ><span class="font-bold">{{ t.fullName }}</span>
                <span class="text-gray-600 dark:text-gray-400"> · {{ t.phoneNumber }}</span></span
              >
              <span class="flex items-center gap-2">
                @if (t.status === 'pending') {
                  <span
                    class="badge border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                    >Chờ duyệt</span
                  >
                  <button
                    type="button"
                    class="btn-primary"
                    [disabled]="busy()"
                    (click)="approve(t)"
                  >
                    <!-- Haihs: icon cho nút giống bản gốc - start -->
                    <!-- đóng code cũ -->
                    <!-- Duyệt -->
                    <app-icon name="check" svgClass="h-4 w-4" /> Duyệt
                    <!-- Haihs: icon cho nút giống bản gốc - end -->
                  </button>
                }
                @if (t.userId !== me()) {
                  <button
                    type="button"
                    class="btn-danger"
                    [disabled]="busy()"
                    [attr.aria-label]="'Gỡ giáo viên ' + t.fullName"
                    (click)="remove(t)"
                  >
                    <!-- Haihs: icon cho nút giống bản gốc - start -->
                    <!-- đóng code cũ -->
                    <!-- Gỡ -->
                    <app-icon name="user-minus" svgClass="h-4 w-4" /> Gỡ
                    <!-- Haihs: icon cho nút giống bản gốc - end -->
                  </button>
                }
              </span>
            </li>
          }
        </ul>
      }
    </section>
  `,
  // Haihs: SearchSelect có chế độ tìm phía server, ô thêm giáo viên dùng nó như bản gốc - end
})
export class ClassTeachersTab implements OnDestroy {
  readonly classId = input.required<string>();
  readonly changed = output<void>();
  private readonly api = inject(ClassesApi);
  private readonly alert = inject(AlertService);
  private readonly confirm = inject(ConfirmService);
  private readonly auth = inject(AuthService);
  protected readonly me = computed(() => this.auth.user()?.id);

  protected readonly teachers = signal<ClassMemberDto[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal('');
  protected readonly busy = signal(false);
  protected readonly q = signal('');
  protected readonly found = signal<Paged<Found> | null>(null);
  protected readonly searchError = signal('');
  private loadSub?: Subscription;
  private searchSub?: Subscription;
  private timer?: ReturnType<typeof setTimeout>;

  constructor() {
    // classId is a required input: load once it is available (next microtask, after bindings are set).
    queueMicrotask(() => this.load());
  }

  ngOnDestroy(): void {
    this.loadSub?.unsubscribe();
    this.searchSub?.unsubscribe();
    clearTimeout(this.timer);
  }

  protected load(): void {
    this.loadSub?.unsubscribe(); // latest wins
    this.loading.set(true);
    this.loadError.set('');
    this.loadSub = this.api.teachers(this.classId()).subscribe({
      next: (list) => {
        this.teachers.set(list);
        this.loading.set(false);
      },
      error: (e: unknown) => {
        this.loadError.set(describeClassError(e, 'Không tải được danh sách giáo viên.'));
        this.loading.set(false);
      },
    });
  }

  protected onSearch(e: Event): void {
    // Haihs: SearchSelect có chế độ tìm phía server, ô thêm giáo viên dùng nó như bản gốc - start
    // đóng code cũ
    // const v = (e.target as HTMLInputElement).value;
    this.search((e.target as HTMLInputElement).value);
  }
  protected search(v: string): void {
    // Haihs: SearchSelect có chế độ tìm phía server, ô thêm giáo viên dùng nó như bản gốc - end
    this.q.set(v);
    clearTimeout(this.timer);
    this.searchSub?.unsubscribe(); // a stale answer must never replace a newer query
    this.searchError.set('');
    if (v.trim().length < SEARCH_MIN) {
      this.found.set(null);
      return;
    }
    this.timer = setTimeout(() => {
      this.searchSub = this.api.teacherSearch(this.classId(), { q: v.trim() }).subscribe({
        next: (r) => this.found.set(r),
        error: (err: unknown) => {
          this.found.set(null);
          this.searchError.set(describeClassError(err, 'Không tìm được giáo viên.'));
        },
      });
    }, SEARCH_DEBOUNCE_MS);
  }

  /** One mutation at a time (single-flight). */
  private act(op: Observable<unknown>, ok: string, fallback: string): void {
    if (this.busy()) return;
    this.busy.set(true);
    op.pipe(finalize(() => this.busy.set(false))).subscribe({
      next: () => {
        void this.alert.success(ok);
        this.load();
        this.changed.emit();
      },
      error: (e: unknown) => void this.alert.error(describeClassError(e, fallback)),
    });
  }

  // Haihs: SearchSelect có chế độ tìm phía server, ô thêm giáo viên dùng nó như bản gốc - start
  protected readonly teacherOptions = computed(() =>
    (this.found()?.items ?? []).map((u) => ({
      key: u.userId,
      label: u.fullName,
      hint: u.phoneNumber,
    })),
  );
  protected readonly memberKeys = computed(() =>
    (this.found()?.items ?? []).filter((u) => u.alreadyMember).map((u) => u.userId),
  );
  protected addById(id: string): void {
    const u = this.found()?.items.find((x) => x.userId === id);
    if (u) this.add(u);
  }
  // Haihs: SearchSelect có chế độ tìm phía server, ô thêm giáo viên dùng nó như bản gốc - end
  protected add(u: Found): void {
    this.act(
      this.api.addTeacher(this.classId(), { teacherId: u.userId }),
      'Đã thêm giáo viên.',
      'Không thêm được giáo viên.',
    );
    this.found.set(null);
    this.q.set('');
  }

  protected approve(t: ClassMemberDto): void {
    this.act(
      this.api.approveTeacher(this.classId(), t.userId),
      'Đã duyệt giáo viên.',
      'Không duyệt được giáo viên.',
    );
  }

  protected async remove(t: ClassMemberDto): Promise<void> {
    const ok = await this.confirm.confirm(`Gỡ giáo viên "${t.fullName}" khỏi lớp?`, {
      title: 'Gỡ giáo viên?',
      confirmText: 'Gỡ',
      cancelText: 'Hủy',
      danger: true,
    });
    if (!ok) return;
    // LAST_TEACHER comes back as a 409 and describeClassError turns it into the Vietnamese text.
    this.act(
      this.api.removeTeacher(this.classId(), t.userId),
      'Đã gỡ giáo viên.',
      'Không gỡ được giáo viên.',
    );
  }
}
