// Created by Haihs on 12/11/2026
// <app-class-students-tab>: students of a class (approved / pending), search, paging, approve/reject/remove/rename/reset password, add, import. Port of ClassStudentsTab.jsx.
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
import { ClassesApi, Paged } from '../../core/classes.api';
import { describeClassError } from '../utils/class-ui';
import { ActionMenu, ActionMenuItem } from './action-menu';
import { AlertService } from './alert.service';
import { ClassImportPanel } from './class-import-panel';
import { ConfirmService } from './confirm-modal';
import { Pager } from './pager';
import { Skeleton } from './skeleton';
import { StudentAddModal, StudentRenameModal } from './student-modals';
import { TempPasswordEntry, TempPasswordModal } from './temp-password-modal';
import { Icon } from './icon';
import { SearchSelect } from './search-select';

type Status = 'approved' | 'pending';
const PAGE_SIZE = 50;

@Component({
  selector: 'app-class-students-tab',
  imports: [
    ActionMenu,
    ClassImportPanel,
    Pager,
    Skeleton,
    StudentAddModal,
    StudentRenameModal,
    TempPasswordModal,
    // Haihs: icon cho nút giống bản gốc - start
    Icon,
    // Haihs: icon cho nút giống bản gốc - end
    // Haihs: ô lọc học sinh trong lớp là SearchSelect có nút Bỏ lọc như bản gốc - start
    SearchSelect,
    // Haihs: ô lọc học sinh trong lớp là SearchSelect có nút Bỏ lọc như bản gốc - end
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Haihs: ô lọc học sinh trong lớp là SearchSelect có nút Bỏ lọc như bản gốc - start
  // đóng code cũ
  //   template: `
  //     <section class="space-y-5" aria-label="Học sinh của lớp">
  //       @if (!accepting()) {
  //         <p
  //           role="note"
  //           class="rounded-lg bg-amber-50 p-3 text-base text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
  //         >
  //           Lớp không nhận thêm học sinh (đã tốt nghiệp hoặc đã xóa).
  //         </p>
  //       }
  //       <div class="flex flex-wrap items-center justify-between gap-3">
  //         <div class="flex gap-2">
  //           @for (s of statuses; track s[0]) {
  //             <button
  //               type="button"
  //               class="rounded-lg px-4 py-2 text-base font-semibold"
  //               [class]="
  //                 status() === s[0]
  //                   ? 'bg-primary-700 text-white'
  //                   : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100'
  //               "
  //               [attr.aria-pressed]="status() === s[0]"
  //               (click)="switchStatus(s[0])"
  //             >
  //               {{ s[1] }}
  //             </button>
  //           }
  //         </div>
  //         <div class="flex flex-wrap gap-2">
  //           <button
  //             type="button"
  //             class="btn-secondary"
  //             [disabled]="!accepting()"
  //             (click)="adding.set(true)"
  //           >
  //             Thêm học sinh
  //           </button>
  //           <button
  //             type="button"
  //             class="btn-secondary"
  //             [attr.aria-pressed]="showImport()"
  //             (click)="showImport.update((v) => !v)"
  //           >
  //             Nhập từ file
  //           </button>
  //         </div>
  //       </div>
  //       @if (showImport()) {
  //         <app-class-import-panel
  //           [classId]="classId()"
  //           [disabled]="!accepting()"
  //           (imported)="onImported()"
  //         />
  //       }
  //       <input
  //         type="search"
  //         name="q"
  //         aria-label="Tìm học sinh theo tên"
  //         placeholder="Tìm học sinh..."
  //         maxlength="50"
  //         class="input sm:max-w-xs"
  //         [value]="q()"
  //         (input)="onSearch($event)"
  //       />
  //       @if (status() === 'pending' && (data()?.total ?? 0) > 0) {
  //         <div class="flex flex-wrap gap-2">
  //           <button
  //             type="button"
  //             class="btn-primary"
  //             [disabled]="busy() || !accepting()"
  //             (click)="approveAll()"
  //           >
  //             <!-- Haihs: icon cho nút giống bản gốc - start -->
  //             <!-- đóng code cũ -->
  //             <!-- Duyệt tất cả -->
  //             <app-icon name="check" svgClass="h-4 w-4" /> Duyệt tất cả
  //             <!-- Haihs: icon cho nút giống bản gốc - end -->
  //           </button>
  //           <button type="button" class="btn-danger" [disabled]="busy()" (click)="rejectAll()">
  //             Từ chối tất cả
  //           </button>
  //         </div>
  //       }
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
  //       } @else if (data(); as d) {
  //         @if (d.items.length === 0) {
  //           <p class="text-base text-gray-600 dark:text-gray-400">
  //             {{
  //               applied
  //                 ? 'Không tìm thấy học sinh phù hợp.'
  //                 : status() === 'pending'
  //                   ? 'Không có yêu cầu chờ duyệt.'
  //                   : 'Lớp chưa có học sinh.'
  //             }}
  //           </p>
  //         }
  //         <ul class="space-y-2">
  //           @for (r of rows(); track r.s.userId) {
  //             <li
  //               class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
  //             >
  //               <span class="min-w-0"
  //                 ><span class="font-bold">{{ r.s.fullName }}</span>
  //                 <span class="text-gray-600 dark:text-gray-400"> · {{ r.s.phoneNumber }}</span></span
  //               >
  //               <app-action-menu [items]="r.menu" [label]="'Thao tác với ' + r.s.fullName" />
  //             </li>
  //           }
  //         </ul>
  //         <app-pager
  //           [page]="d.page"
  //           [totalPages]="d.totalPages"
  //           [total]="d.total"
  //           unit="học sinh"
  //           (pageChange)="goPage($event)"
  //         />
  //       }
  //     </section>

  //     @if (adding()) {
  //       <app-student-add-modal
  //         [classId]="classId()"
  //         (added)="onChanged()"
  //         (cancelled)="adding.set(false)"
  //       />
  //     }
  //     @if (renaming(); as s) {
  //       <app-student-rename-modal
  //         [classId]="classId()"
  //         [student]="s"
  //         (saved)="renaming.set(null); load()"
  //         (cancelled)="renaming.set(null)"
  //       />
  //     }
  //     @if (tempPassword(); as t) {
  //       <app-temp-password-modal [entry]="t" (closed)="tempPassword.set(null)" />
  //     }
  //   `,
  // Haihs: form thêm học sinh nằm ngay trong tab như bản gốc - start
  // đóng code cũ
  //   template: `
  //     <section class="space-y-5" aria-label="Học sinh của lớp">
  //       @if (!accepting()) {
  //         <p
  //           role="note"
  //           class="rounded-lg bg-amber-50 p-3 text-base text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
  //         >
  //           Lớp không nhận thêm học sinh (đã tốt nghiệp hoặc đã xóa).
  //         </p>
  //       }
  //       <div class="flex flex-wrap items-center justify-between gap-3">
  //         <div class="flex gap-2">
  //           @for (s of statuses; track s[0]) {
  //             <button
  //               type="button"
  //               class="rounded-lg px-4 py-2 text-base font-semibold"
  //               [class]="
  //                 status() === s[0]
  //                   ? 'bg-primary-700 text-white'
  //                   : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100'
  //               "
  //               [attr.aria-pressed]="status() === s[0]"
  //               (click)="switchStatus(s[0])"
  //             >
  //               {{ s[1] }}
  //             </button>
  //           }
  //         </div>
  //         <div class="flex flex-wrap gap-2">
  //           <button
  //             type="button"
  //             class="btn-secondary"
  //             [disabled]="!accepting()"
  //             (click)="adding.set(true)"
  //           >
  //             Thêm học sinh
  //           </button>
  //           <button
  //             type="button"
  //             class="btn-secondary"
  //             [attr.aria-pressed]="showImport()"
  //             (click)="showImport.update((v) => !v)"
  //           >
  //             Nhập từ file
  //           </button>
  //         </div>
  //       </div>
  //       @if (showImport()) {
  //         <app-class-import-panel
  //           [classId]="classId()"
  //           [disabled]="!accepting()"
  //           (imported)="onImported()"
  //         />
  //       }
  //       <div class="flex flex-wrap items-start gap-3">
  //         <app-search-select
  //           class="w-full sm:max-w-xs"
  //           label="Tìm học sinh trong lớp"
  //           placeholder="Tìm theo tên trong lớp"
  //           emptyText="Không tìm thấy học sinh nào"
  //           [remote]="true"
  //           [options]="filterOptions()"
  //           (queryChange)="onQuery($event)"
  //           (picked)="pickFilter($event)"
  //         />
  //         @if (filterName()) {
  //           <p class="flex items-center gap-2 pt-2 text-base text-gray-600 dark:text-gray-400">
  //             Đang lọc: <strong>{{ filterName() }}</strong>
  //             <button type="button" (click)="clearFilter()" class="font-semibold underline">
  //               Bỏ lọc
  //             </button>
  //           </p>
  //         }
  //       </div>
  //       @if (status() === 'pending' && (data()?.total ?? 0) > 0) {
  //         <div class="flex flex-wrap gap-2">
  //           <button
  //             type="button"
  //             class="btn-primary"
  //             [disabled]="busy() || !accepting()"
  //             (click)="approveAll()"
  //           >
  //             <!-- Haihs: icon cho nút giống bản gốc - start -->
  //             <!-- đóng code cũ -->
  //             <!-- Duyệt tất cả -->
  //             <app-icon name="check" svgClass="h-4 w-4" /> Duyệt tất cả
  //             <!-- Haihs: icon cho nút giống bản gốc - end -->
  //           </button>
  //           <button type="button" class="btn-danger" [disabled]="busy()" (click)="rejectAll()">
  //             Từ chối tất cả
  //           </button>
  //         </div>
  //       }
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
  //       } @else if (data(); as d) {
  //         @if (d.items.length === 0) {
  //           <p class="text-base text-gray-600 dark:text-gray-400">
  //             {{
  //               applied
  //                 ? 'Không tìm thấy học sinh phù hợp.'
  //                 : status() === 'pending'
  //                   ? 'Không có yêu cầu chờ duyệt.'
  //                   : 'Lớp chưa có học sinh.'
  //             }}
  //           </p>
  //         }
  //         <ul class="space-y-2">
  //           @for (r of rows(); track r.s.userId) {
  //             <li
  //               class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
  //             >
  //               <span class="min-w-0"
  //                 ><span class="font-bold">{{ r.s.fullName }}</span>
  //                 <span class="text-gray-600 dark:text-gray-400"> · {{ r.s.phoneNumber }}</span></span
  //               >
  //               <app-action-menu [items]="r.menu" [label]="'Thao tác với ' + r.s.fullName" />
  //             </li>
  //           }
  //         </ul>
  //         <app-pager
  //           [page]="d.page"
  //           [totalPages]="d.totalPages"
  //           [total]="d.total"
  //           unit="học sinh"
  //           (pageChange)="goPage($event)"
  //         />
  //       }
  //     </section>

  //     @if (adding()) {
  //       <app-student-add-modal
  //         [classId]="classId()"
  //         (added)="onChanged()"
  //         (cancelled)="adding.set(false)"
  //       />
  //     }
  //     @if (renaming(); as s) {
  //       <app-student-rename-modal
  //         [classId]="classId()"
  //         [student]="s"
  //         (saved)="renaming.set(null); load()"
  //         (cancelled)="renaming.set(null)"
  //       />
  //     }
  //     @if (tempPassword(); as t) {
  //       <app-temp-password-modal [entry]="t" (closed)="tempPassword.set(null)" />
  //     }
  //   `,
  template: `
    <section class="space-y-5" aria-label="Học sinh của lớp">
      @if (!accepting()) {
        <p
          role="note"
          class="rounded-lg bg-amber-50 p-3 text-base text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
        >
          Lớp không nhận thêm học sinh (đã tốt nghiệp hoặc đã xóa).
        </p>
      }
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex gap-2">
          @for (s of statuses; track s[0]) {
            <button
              type="button"
              class="rounded-lg px-4 py-2 text-base font-semibold"
              [class]="
                status() === s[0]
                  ? 'bg-primary-700 text-white'
                  : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100'
              "
              [attr.aria-pressed]="status() === s[0]"
              (click)="switchStatus(s[0])"
            >
              {{ s[1] }}
            </button>
          }
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="btn-secondary"
            [attr.aria-pressed]="showImport()"
            (click)="showImport.update((v) => !v)"
          >
            Nhập từ file
          </button>
        </div>
      </div>
      @if (showImport()) {
        <app-class-import-panel
          [classId]="classId()"
          [disabled]="!accepting()"
          (imported)="onImported()"
        />
      }
      <section
        class="space-y-3 rounded-xl border border-gray-200 bg-white p-5 shadow-raised dark:border-gray-700 dark:bg-gray-800 dark:shadow-raised-dark"
      >
        <h3 class="font-bold text-gray-800 dark:text-gray-100">Thêm bằng cách chọn</h3>
        <p class="text-sm text-gray-600 dark:text-gray-400">
          Gõ số điện thoại (ít nhất 3 chữ số) hoặc họ tên, rồi chọn học sinh. Hãy đối chiếu số điện
          thoại trước khi thêm.
        </p>
        @if (accepting()) {
          <app-student-add-modal [classId]="classId()" [inline]="true" (added)="onChanged()" />
        } @else {
          <p class="text-sm text-amber-700 dark:text-amber-300">
            Lớp đã tốt nghiệp không nhận thành viên mới: hãy chuyển về Đang học để thêm.
          </p>
        }
      </section>
      <div class="flex flex-wrap items-start gap-3">
        <app-search-select
          class="w-full sm:max-w-xs"
          label="Tìm học sinh trong lớp"
          placeholder="Tìm theo tên trong lớp"
          emptyText="Không tìm thấy học sinh nào"
          [remote]="true"
          [options]="filterOptions()"
          (queryChange)="onQuery($event)"
          (picked)="pickFilter($event)"
        />
        @if (filterName()) {
          <p class="flex items-center gap-2 pt-2 text-base text-gray-600 dark:text-gray-400">
            Đang lọc: <strong>{{ filterName() }}</strong>
            <button type="button" (click)="clearFilter()" class="font-semibold underline">
              Bỏ lọc
            </button>
          </p>
        }
      </div>
      @if (status() === 'pending' && (data()?.total ?? 0) > 0) {
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="btn-primary"
            [disabled]="busy() || !accepting()"
            (click)="approveAll()"
          >
            <!-- Haihs: icon cho nút giống bản gốc - start -->
            <!-- đóng code cũ -->
            <!-- Duyệt tất cả -->
            <app-icon name="check" svgClass="h-4 w-4" /> Duyệt tất cả
            <!-- Haihs: icon cho nút giống bản gốc - end -->
          </button>
          <button type="button" class="btn-danger" [disabled]="busy()" (click)="rejectAll()">
            Từ chối tất cả
          </button>
        </div>
      }
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
      } @else if (data(); as d) {
        @if (d.items.length === 0) {
          <p class="text-base text-gray-600 dark:text-gray-400">
            {{
              applied
                ? 'Không tìm thấy học sinh phù hợp.'
                : status() === 'pending'
                  ? 'Không có yêu cầu chờ duyệt.'
                  : 'Lớp chưa có học sinh.'
            }}
          </p>
        }
        <ul class="space-y-2">
          @for (r of rows(); track r.s.userId) {
            <li
              class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
            >
              <span class="min-w-0"
                ><span class="font-bold">{{ r.s.fullName }}</span>
                <span class="text-gray-600 dark:text-gray-400"> · {{ r.s.phoneNumber }}</span></span
              >
              <!-- Haihs: nút hiện đủ trên web, ⋮ chỉ trên điện thoại - start -->
              <!-- đóng code cũ -->
              <!-- <app-action-menu [items]="r.menu" [label]="'Thao tác với ' + r.s.fullName" /> -->
              <div class="hidden flex-wrap justify-end gap-2 md:flex">
                @for (it of r.menu; track it.label) {
                  <button
                    type="button"
                    [class]="it.danger ? 'btn-danger' : 'btn-secondary'"
                    [disabled]="it.disabled"
                    (click)="it.onClick?.()"
                  >
                    {{ it.label }}
                  </button>
                }
              </div>
              <app-action-menu
                class="md:hidden"
                [items]="r.menu"
                [label]="'Thao tác với ' + r.s.fullName"
              />
              <!-- Haihs: nút hiện đủ trên web, ⋮ chỉ trên điện thoại - end -->
            </li>
          }
        </ul>
        <app-pager
          [page]="d.page"
          [totalPages]="d.totalPages"
          [total]="d.total"
          unit="học sinh"
          (pageChange)="goPage($event)"
        />
      }
    </section>

    @if (adding()) {
      <app-student-add-modal
        [classId]="classId()"
        (added)="onChanged()"
        (cancelled)="adding.set(false)"
      />
    }
    @if (renaming(); as s) {
      <app-student-rename-modal
        [classId]="classId()"
        [student]="s"
        (saved)="renaming.set(null); load()"
        (cancelled)="renaming.set(null)"
      />
    }
    @if (tempPassword(); as t) {
      <app-temp-password-modal [entry]="t" (closed)="tempPassword.set(null)" />
    }
  `,
  // Haihs: form thêm học sinh nằm ngay trong tab như bản gốc - end
  // Haihs: ô lọc học sinh trong lớp là SearchSelect có nút Bỏ lọc như bản gốc - end
})
export class ClassStudentsTab implements OnDestroy {
  readonly classId = input.required<string>();
  /** false for a deleted or graduated class: adding / approving / importing is off. */
  readonly accepting = input(true);
  readonly changed = output<void>();
  private readonly api = inject(ClassesApi);
  private readonly alert = inject(AlertService);
  private readonly confirm = inject(ConfirmService);

  protected readonly statuses: [Status, string][] = [
    ['approved', 'Đã duyệt'],
    ['pending', 'Chờ duyệt'],
  ];
  protected readonly status = signal<Status>('approved');
  protected readonly page = signal(1);
  protected readonly q = signal('');
  protected applied = '';
  protected readonly data = signal<Paged<ClassMemberDto> | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadError = signal('');
  protected readonly busy = signal(false);
  protected readonly adding = signal(false);
  protected readonly showImport = signal(false);
  protected readonly renaming = signal<ClassMemberDto | null>(null);
  protected readonly tempPassword = signal<TempPasswordEntry | null>(null);
  private sub?: Subscription;
  private timer?: ReturnType<typeof setTimeout>;

  protected readonly rows = computed(() =>
    (this.data()?.items ?? []).map((s) => {
      const menu: ActionMenuItem[] =
        s.status === 'pending'
          ? [
              {
                label: 'Duyệt',
                disabled: this.busy() || !this.accepting(),
                onClick: () => this.approve(s),
              },
              {
                label: 'Từ chối',
                danger: true,
                disabled: this.busy(),
                onClick: () => void this.remove(s, true),
              },
            ]
          : [
              { label: 'Sửa tên', onClick: () => this.renaming.set(s) },
              {
                label: 'Đặt lại mật khẩu',
                disabled: this.busy(),
                onClick: () => void this.reset(s),
              },
              {
                // Haihs: chữ xác nhận lớp học và nút Rời lớp của giáo viên giống bản gốc - start
                // đóng code cũ
                // label: 'Xóa khỏi lớp',
                label: 'Gỡ khỏi lớp',
                // Haihs: chữ xác nhận lớp học và nút Rời lớp của giáo viên giống bản gốc - end
                danger: true,
                disabled: this.busy(),
                onClick: () => void this.remove(s, false),
              },
            ];
      return { s, menu };
    }),
  );

  constructor() {
    queueMicrotask(() => this.load());
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    clearTimeout(this.timer);
    this.tempPassword.set(null); // the one-time password never outlives the tab
  }

  /** Latest wins: the previous request is cancelled, so a slow old answer cannot overwrite a newer one. */
  protected load(): void {
    this.sub?.unsubscribe();
    this.loading.set(true);
    this.loadError.set('');
    this.sub = this.api
      .students(this.classId(), {
        status: this.status(),
        page: this.page(),
        limit: PAGE_SIZE,
        q: this.applied || undefined,
      })
      .subscribe({
        next: (r) => {
          this.data.set(r);
          this.loading.set(false);
        },
        error: (e: unknown) => {
          this.data.set(null);
          this.loadError.set(describeClassError(e, 'Không tải được danh sách học sinh.'));
          this.loading.set(false);
        },
      });
  }

  protected switchStatus(s: Status): void {
    this.status.set(s);
    this.page.set(1);
    this.load();
  }
  protected goPage(p: number): void {
    this.page.set(p);
    this.load();
  }
  // Haihs: ô lọc học sinh trong lớp là SearchSelect có nút Bỏ lọc như bản gốc - start
  protected readonly filterName = signal('');
  protected readonly filterOptions = computed(() =>
    (this.data()?.items ?? []).map((m) => ({
      key: m.userId,
      label: m.fullName,
      hint: m.phoneNumber,
    })),
  );
  /** Typing in the search box narrows the loaded list (server side, debounced). */
  protected onQuery(v: string): void {
    if (v === '' && this.filterName()) return; // the box is cleared right after picking: keep the chosen filter
    this.filterName.set('');
    this.runSearch(v);
  }
  protected pickFilter(id: string): void {
    const m = this.data()?.items.find((x) => x.userId === id);
    if (!m) return;
    this.filterName.set(m.fullName);
    this.runSearch(m.fullName);
  }
  protected clearFilter(): void {
    this.filterName.set('');
    this.runSearch('');
  }
  // Haihs: ô lọc học sinh trong lớp là SearchSelect có nút Bỏ lọc như bản gốc - end
  protected onSearch(e: Event): void {
    // Haihs: ô lọc học sinh trong lớp là SearchSelect có nút Bỏ lọc như bản gốc - start
    // đóng code cũ
    // const v = (e.target as HTMLInputElement).value;
    this.runSearch((e.target as HTMLInputElement).value);
  }
  private runSearch(v: string): void {
    // Haihs: ô lọc học sinh trong lớp là SearchSelect có nút Bỏ lọc như bản gốc - end
    this.q.set(v);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      const next = v.trim();
      if (next === this.applied) return;
      this.applied = next;
      this.page.set(1);
      this.load();
    }, 300);
  }

  protected onChanged(): void {
    this.load();
    this.changed.emit();
  }
  protected onImported(): void {
    this.onChanged();
  }

  /** One mutation at a time (single-flight). */
  private act(op: Observable<unknown>, ok: string, fallback: string): void {
    if (this.busy()) return;
    this.busy.set(true);
    op.pipe(finalize(() => this.busy.set(false))).subscribe({
      next: () => {
        void this.alert.success(ok);
        if (this.data()?.items.length === 1 && this.page() > 1) this.page.update((p) => p - 1);
        this.onChanged();
      },
      error: (e: unknown) => void this.alert.error(describeClassError(e, fallback)),
    });
  }

  protected approve(s: ClassMemberDto): void {
    this.act(
      this.api.approveStudent(this.classId(), s.userId),
      'Đã duyệt học sinh.',
      'Không duyệt được học sinh.',
    );
  }

  protected async approveAll(): Promise<void> {
    // Haihs: chữ xác nhận lớp học và nút Rời lớp của giáo viên giống bản gốc - start
    // đóng code cũ
    // const ok = await this.confirm.confirm('Duyệt tất cả học sinh đang chờ?', {
    // title: 'Duyệt tất cả?',
    // confirmText: 'Duyệt tất cả',
    // cancelText: 'Hủy',
    // });
    const ok = await this.confirm.confirm(
      `Duyệt toàn bộ ${this.data()?.total ?? ''} học sinh đang chờ vào lớp?`,
      {
        title: 'Duyệt tất cả?',
        confirmText: 'Duyệt tất cả',
        cancelText: 'Hủy',
      },
    );
    // Haihs: chữ xác nhận lớp học và nút Rời lớp của giáo viên giống bản gốc - end
    if (ok)
      this.act(
        this.api.approveAllStudents(this.classId()),
        'Đã duyệt tất cả.',
        'Không duyệt được.',
      );
  }

  protected async rejectAll(): Promise<void> {
    const ok = await this.confirm.confirm(
      // Haihs: chữ xác nhận lớp học và nút Rời lớp của giáo viên giống bản gốc - start
      // đóng code cũ
      // 'Từ chối tất cả yêu cầu đang chờ? Học sinh có thể xin vào lại bằng link mời.',
      `Từ chối toàn bộ ${this.data()?.total ?? ''} học sinh đang chờ? Họ có thể xin vào lại bằng link mời.`,
      // Haihs: chữ xác nhận lớp học và nút Rời lớp của giáo viên giống bản gốc - end
      {
        title: 'Từ chối tất cả?',
        confirmText: 'Từ chối tất cả',
        cancelText: 'Hủy',
        danger: true,
      },
    );
    if (ok)
      this.act(
        this.api.rejectAllStudents(this.classId()),
        'Đã từ chối tất cả.',
        'Không từ chối được.',
      );
  }

  protected async remove(s: ClassMemberDto, reject: boolean): Promise<void> {
    const ok = await this.confirm.confirm(
      reject
        ? `Từ chối yêu cầu của "${s.fullName}"?`
        : // Haihs: chữ xác nhận lớp học và nút Rời lớp của giáo viên giống bản gốc - start
          // đóng code cũ
          // : `Xóa "${s.fullName}" khỏi lớp? Tài khoản học sinh vẫn còn.`,
          `Gỡ ${s.fullName} khỏi lớp? Tài khoản của học sinh vẫn được giữ.`,
      // Haihs: chữ xác nhận lớp học và nút Rời lớp của giáo viên giống bản gốc - end
      {
        // Haihs: chữ xác nhận lớp học và nút Rời lớp của giáo viên giống bản gốc - start
        // đóng code cũ
        // title: reject ? 'Từ chối?' : 'Xóa khỏi lớp?',
        // confirmText: reject ? 'Từ chối' : 'Xóa',
        title: reject ? 'Từ chối?' : 'Gỡ học sinh?',
        confirmText: reject ? 'Từ chối' : 'Gỡ',
        // Haihs: chữ xác nhận lớp học và nút Rời lớp của giáo viên giống bản gốc - end
        cancelText: 'Hủy',
        danger: true,
      },
    );
    if (ok)
      this.act(
        this.api.removeStudent(this.classId(), s.userId),
        reject ? 'Đã từ chối.' : 'Đã xóa khỏi lớp.',
        'Không thực hiện được.',
      );
  }

  protected async reset(s: ClassMemberDto): Promise<void> {
    const ok = await this.confirm.confirm(
      // Haihs: chữ xác nhận lớp học và nút Rời lớp của giáo viên giống bản gốc - start
      // đóng code cũ
      // `Đặt lại mật khẩu cho "${s.fullName}"? Mật khẩu cũ và mọi phiên đăng nhập hiện tại sẽ bị vô hiệu.`,
      `Đặt mật khẩu tạm mới cho ${s.fullName}? Học sinh sẽ bị đăng xuất khỏi mọi thiết bị và phải đổi mật khẩu khi đăng nhập lại.`,
      // Haihs: chữ xác nhận lớp học và nút Rời lớp của giáo viên giống bản gốc - end
      { title: 'Đặt lại mật khẩu?', confirmText: 'Đặt lại', cancelText: 'Hủy', danger: true },
    );
    if (!ok || this.busy()) return;
    this.busy.set(true);
    this.api
      .resetStudentPassword(this.classId(), s.userId)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: (r) =>
          this.tempPassword.set({
            fullName: s.fullName,
            phoneNumber: s.phoneNumber ?? '',
            temporaryPassword: r.temporaryPassword,
          }),
        error: (e: unknown) =>
          void this.alert.error(describeClassError(e, 'Không đặt lại được mật khẩu.')),
      });
  }
}
