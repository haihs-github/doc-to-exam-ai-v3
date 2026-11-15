// Created by Haihs on 12/11/2026
// Student modals: rename and add (search by name/phone or add by exact phone). Port of StudentModals.jsx.
import {
  // Haihs: ô thêm học sinh dùng SearchSelect như bản gốc - start
  computed,
  // Haihs: ô thêm học sinh dùng SearchSelect như bản gốc - end
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import type { ClassMemberDto } from '@doc-to-exam/contract';
import { Subscription, finalize } from 'rxjs';
import { ClassesApi, Paged } from '../../core/classes.api';
import { focusField } from '../../pages/form-helpers';
import { describeClassError } from '../utils/class-ui';
import { AlertService } from './alert.service';
import { FormField } from './form-field';
import { ModalFocus } from './modal-focus';
import { SearchSelect } from './search-select';

const MODAL =
  'w-full max-w-md space-y-3 rounded-lg border border-gray-200 bg-white p-6 shadow-overlay dark:border-gray-700 dark:bg-gray-800 dark:shadow-overlay-dark';

@Component({
  selector: 'app-student-rename-modal',
  imports: [FormField, ModalFocus],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form
        appModalFocus
        (dismissed)="cancel()"
        (submit)="submit($event)"
        novalidate
        role="dialog"
        aria-modal="true"
        aria-labelledby="rename-student-title"
        [class]="modal"
      >
        <h2 id="rename-student-title" class="text-lg font-bold text-gray-900 dark:text-gray-100">
          Sửa tên học sinh
        </h2>
        <app-form-field label="Họ và tên" [required]="true" [error]="error()">
          <input
            class="input"
            name="fullName"
            maxlength="255"
            autocomplete="off"
            [value]="value()"
            (input)="onInput($event)"
          />
        </app-form-field>
        <div class="flex gap-3 pt-1">
          <button type="button" class="btn-secondary flex-1" [disabled]="busy()" (click)="cancel()">
            Hủy
          </button>
          <button type="submit" class="btn-primary flex-1" [disabled]="busy()">Lưu</button>
        </div>
      </form>
    </div>
  `,
})
export class StudentRenameModal {
  readonly classId = input.required<string>();
  readonly student = input.required<ClassMemberDto>();
  readonly saved = output<void>();
  readonly cancelled = output<void>();
  protected readonly modal = MODAL;
  private readonly api = inject(ClassesApi);
  private readonly alert = inject(AlertService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly value = signal<string | null>(null);
  protected readonly error = signal('');
  protected readonly busy = signal(false);

  protected onInput(e: Event): void {
    this.value.set((e.target as HTMLInputElement).value);
    this.error.set('');
  }
  protected cancel(): void {
    if (!this.busy()) this.cancelled.emit();
  }
  protected submit(e: Event): void {
    e.preventDefault();
    if (this.busy()) return; // single-flight
    const name = (this.value() ?? this.student().fullName).trim();
    if (!name) {
      this.error.set('Họ và tên là bắt buộc.');
      return focusField(this.host.nativeElement, 'fullName');
    }
    this.busy.set(true);
    this.api
      .renameStudent(this.classId(), this.student().userId, name)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: () => {
          this.saved.emit();
          void this.alert.success('Đã cập nhật tên.');
        },
        error: (err: unknown) => {
          const msg = describeClassError(err, 'Không sửa được tên.');
          if ((err as { field?: string }).field === 'fullName') {
            this.error.set(msg);
            focusField(this.host.nativeElement, 'fullName');
          } else void this.alert.error(msg);
        },
      });
  }
}

type Found = ClassMemberDto & { alreadyMember?: boolean };

@Component({
  selector: 'app-student-add-modal',
  // Haihs: ô thêm học sinh dùng SearchSelect như bản gốc - start
  // đóng code cũ
  // imports: [ModalFocus],
  imports: [ModalFocus, SearchSelect],
  // Haihs: ô thêm học sinh dùng SearchSelect như bản gốc - end
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Haihs: ô thêm học sinh dùng SearchSelect như bản gốc - start
  // đóng code cũ
  //   template: `
  //     <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
  //       <div
  //         appModalFocus
  //         (dismissed)="cancel()"
  //         role="dialog"
  //         aria-modal="true"
  //         aria-labelledby="add-student-title"
  //         [class]="modal"
  //       >
  //         <h2 id="add-student-title" class="text-lg font-bold text-gray-900 dark:text-gray-100">
  //           Thêm học sinh
  //         </h2>
  //         <label
  //           for="student-search"
  //           class="block text-base font-medium text-gray-800 dark:text-gray-200"
  //           >Tên hoặc số điện thoại (ít nhất 3 ký tự)</label
  //         >
  //         <input
  //           id="student-search"
  //           type="search"
  //           name="studentSearch"
  //           class="input"
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
  //               Không tìm thấy học sinh phù hợp.
  //             </p>
  //           }
  //           <ul class="max-h-64 space-y-2 overflow-y-auto">
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
  //         <div class="flex justify-end pt-1">
  //           <button type="button" class="btn-secondary" (click)="cancel()">Đóng</button>
  //         </div>
  //       </div>
  //     </div>
  //   `,
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        appModalFocus
        (dismissed)="cancel()"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-student-title"
        [class]="modal"
      >
        <h2 id="add-student-title" class="text-lg font-bold text-gray-900 dark:text-gray-100">
          Thêm học sinh
        </h2>
        <label
          for="student-search"
          class="block text-base font-medium text-gray-800 dark:text-gray-200"
          >Tìm học sinh theo số điện thoại hoặc họ tên</label
        >
        <app-search-select
          label="Số điện thoại hoặc họ tên"
          placeholder="Số điện thoại hoặc họ tên"
          emptyText="Không tìm thấy học sinh phù hợp"
          [remote]="true"
          [minChars]="3"
          [error]="searchError()"
          [options]="studentOptions()"
          [disabledKeys]="memberKeys()"
          (queryChange)="search($event)"
          (picked)="addById($event)"
        />
        <div class="flex justify-end pt-1">
          <button type="button" class="btn-secondary" (click)="cancel()">Đóng</button>
        </div>
      </div>
    </div>
  `,
  // Haihs: ô thêm học sinh dùng SearchSelect như bản gốc - end
})
export class StudentAddModal implements OnDestroy {
  readonly classId = input.required<string>();
  readonly added = output<void>();
  readonly cancelled = output<void>();
  protected readonly modal = MODAL;
  private readonly api = inject(ClassesApi);
  private readonly alert = inject(AlertService);
  protected readonly q = signal('');
  protected readonly found = signal<Paged<Found> | null>(null);
  protected readonly searchError = signal('');
  protected readonly busy = signal(false);
  private sub?: Subscription;
  private timer?: ReturnType<typeof setTimeout>;

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    clearTimeout(this.timer);
  }

  protected cancel(): void {
    this.cancelled.emit();
  }

  protected onSearch(e: Event): void {
    // Haihs: ô thêm học sinh dùng SearchSelect như bản gốc - start
    // đóng code cũ
    // const v = (e.target as HTMLInputElement).value;
    this.search((e.target as HTMLInputElement).value);
  }
  protected search(v: string): void {
    // Haihs: ô thêm học sinh dùng SearchSelect như bản gốc - end
    this.q.set(v);
    clearTimeout(this.timer);
    this.sub?.unsubscribe(); // latest wins
    this.searchError.set('');
    if (v.trim().length < 3) {
      this.found.set(null);
      return;
    }
    this.timer = setTimeout(() => {
      this.sub = this.api.studentSearch(this.classId(), { q: v.trim() }).subscribe({
        next: (r) => this.found.set(r),
        error: (err: unknown) => {
          this.found.set(null);
          this.searchError.set(describeClassError(err, 'Không tìm được học sinh.'));
        },
      });
    }, 300);
  }

  // Haihs: ô thêm học sinh dùng SearchSelect như bản gốc - start
  protected readonly studentOptions = computed(() =>
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
  // Haihs: ô thêm học sinh dùng SearchSelect như bản gốc - end
  protected add(u: Found): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.api
      .addStudent(this.classId(), { studentId: u.userId })
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: () => {
          this.found.update((f) =>
            f
              ? {
                  ...f,
                  items: f.items.map((x) =>
                    x.userId === u.userId ? { ...x, alreadyMember: true } : x,
                  ),
                }
              : f,
          );
          this.added.emit();
          void this.alert.success(`Đã thêm ${u.fullName} vào lớp.`);
        },
        error: (err: unknown) =>
          void this.alert.error(describeClassError(err, 'Không thêm được học sinh.')),
      });
  }
}
