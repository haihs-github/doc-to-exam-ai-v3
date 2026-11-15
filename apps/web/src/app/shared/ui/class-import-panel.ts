// Created by Haihs on 12/11/2026
// <app-class-import-panel>: import students from .csv/.xlsx; shows the result table and keeps temp passwords only in TempPasswordStore. Port of ClassImportPanel.jsx.
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
import { finalize } from 'rxjs';
import { ClassesApi, ImportResponse } from '../../core/classes.api';
import { TempPasswordStore } from '../../core/temp-password-store';
import { copyToClipboard, downloadTextFile, safeFileName } from '../utils/browser';
import { describeClassError } from '../utils/class-ui';
import { buildPasswordCopyText } from '../utils/password-copy';
import {
  IMPORT_STATUS_LABELS,
  buildPasswordCsv,
  studentTemplateCsv,
  validateImportFile,
} from '../utils/student-import';
import { AlertService } from './alert.service';
import { Icon } from './icon';

@Component({
  selector: 'app-class-import-panel',
  // Haihs: khối import file giống bản gốc (chữ, icon) - start
  imports: [Icon],
  // Haihs: khối import file giống bản gốc (chữ, icon) - end
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Haihs: khối import file giống bản gốc (chữ, icon) - start
  // đóng code cũ
  //   template: `
  //     <section
  //       class="space-y-4 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800"
  //       aria-label="Nhập học sinh từ file"
  //     >
  //       <h2 class="text-lg font-bold text-gray-900 dark:text-gray-100">Nhập học sinh từ file</h2>
  //       <p class="text-base text-gray-600 dark:text-gray-400">
  //         File .csv (tối đa 256KB) hoặc .xlsx (tối đa 1MB), tối đa 200 người: cột 1 là họ tên, cột 2
  //         là số điện thoại. Học sinh chưa có tài khoản sẽ được tạo với mật khẩu tạm.
  //       </p>
  //       <div class="flex flex-wrap items-center gap-3">
  //         <button type="button" class="btn-secondary" (click)="downloadTemplate()">
  //           Tải file mẫu
  //         </button>
  //         <label class="block">
  //           <span class="sr-only">Chọn file .csv hoặc .xlsx</span>
  //           <input
  //             type="file"
  //             name="file"
  //             accept=".csv,.xlsx"
  //             [disabled]="disabled() || busy()"
  //             (change)="onPick($event)"
  //           />
  //         </label>
  //         <button
  //           type="button"
  //           class="btn-primary"
  //           [disabled]="disabled() || busy() || !file()"
  //           (click)="upload()"
  //         >
  //           {{ busy() ? 'Đang nhập...' : 'Nhập' }}
  //         </button>
  //       </div>
  //       @if (fileError()) {
  //         <p role="alert" class="text-sm font-medium text-red-700 dark:text-red-300">
  //           {{ fileError() }}
  //         </p>
  //       }
  //       @if (result(); as r) {
  //         <div role="status" class="space-y-3">
  //           <p class="text-base font-semibold">
  //             Tổng {{ r.summary.total }} · tạo mới {{ r.summary.created }} · thêm vào lớp
  //             {{ r.summary.added }} · đã trong lớp {{ r.summary.alreadyMember }} · lỗi
  //             {{ r.summary.errors }}
  //           </p>
  //           @if (passwordRows().length) {
  //             <p class="text-base font-semibold text-amber-800 dark:text-amber-300">
  //               Mật khẩu tạm chỉ có trong phiên này và biến mất khi bạn rời trang hoặc đăng xuất. Hãy
  //               tải về ngay.
  //             </p>
  //             <div class="flex flex-wrap gap-2">
  //               <button type="button" class="btn-secondary" (click)="downloadPasswords()">
  //                 Tải CSV mật khẩu
  //               </button>
  //               <button type="button" class="btn-secondary" (click)="copyPasswords()">
  //                 Sao chép mật khẩu
  //               </button>
  //             </div>
  //           }
  //           <div class="overflow-x-auto">
  //             <table class="w-full text-left text-base">
  //               <caption class="sr-only">
  //                 Kết quả nhập học sinh
  //               </caption>
  //               <thead>
  //                 <tr>
  //                   <th scope="col" class="p-2">Dòng</th>
  //                   <th scope="col" class="p-2">Họ và tên</th>
  //                   <th scope="col" class="p-2">Số điện thoại</th>
  //                   <th scope="col" class="p-2">Kết quả</th>
  //                   <th scope="col" class="p-2">Mật khẩu tạm</th>
  //                 </tr>
  //               </thead>
  //               <tbody>
  //                 @for (row of r.results; track row.row) {
  //                   <tr class="border-t border-gray-200 dark:border-gray-700">
  //                     <td class="p-2">{{ row.row }}</td>
  //                     <td class="p-2">{{ row.fullName }}</td>
  //                     <td class="p-2">{{ row.phoneNumber }}</td>
  //                     <td class="p-2" [class.text-red-700]="row.status === 'error'">
  //                       {{ label(row.status) }}{{ row.message ? ': ' + row.message : '' }}
  //                     </td>
  //                     <td class="p-2 font-mono">{{ row.temporaryPassword ?? '' }}</td>
  //                   </tr>
  //                 }
  //               </tbody>
  //             </table>
  //           </div>
  //         </div>
  //       }
  //     </section>
  //   `,
  template: `
    <section
      class="space-y-4 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800"
      aria-label="Nhập học sinh từ file"
    >
      <h3 class="font-bold text-gray-800 dark:text-gray-100">Thêm bằng import file</h3>
      <p class="text-sm text-gray-600 dark:text-gray-400">
        File CSV (.csv UTF-8, tối đa 256KB) hoặc Excel (.xlsx, tối đa 1MB, chỉ đọc sheet đầu; không
        hỗ trợ .xls), tối đa 200 người mỗi lần, 2 cột: <strong>Họ và tên</strong>,
        <strong>Số điện thoại</strong> (bắt đầu bằng 0, 10-11 chữ số; khi dùng Excel hãy đặt cột số
        điện thoại là Văn bản để không mất số 0). Số điện thoại chưa có tài khoản sẽ được tạo kèm
        mật khẩu tạm; đã có tài khoản học sinh thì chỉ thêm vào lớp.
      </p>
      <div class="flex flex-wrap items-center gap-3">
        <button
          type="button"
          (click)="downloadTemplate()"
          class="flex items-center gap-1.5 text-base text-primary-800 hover:underline dark:text-sky-400"
        >
          <app-icon name="download" svgClass="h-4 w-4" /> Tải file CSV mẫu
        </button>
        <label class="block">
          <span class="sr-only">Chọn file CSV hoặc Excel</span>
          <input
            type="file"
            name="file"
            accept=".csv,.xlsx"
            [disabled]="disabled() || busy()"
            (change)="onPick($event)"
          />
        </label>
        <button
          type="button"
          class="btn-primary"
          [disabled]="disabled() || busy() || !file()"
          (click)="upload()"
        >
          <app-icon name="upload" svgClass="h-4 w-4" /> {{ busy() ? 'Đang xử lý...' : 'Tải lên' }}
        </button>
      </div>
      @if (busy()) {
        <p class="text-base text-gray-600 dark:text-gray-400">
          Đang xử lý, việc này có thể mất vài giây đến vài chục giây. Vui lòng không đóng trang.
        </p>
      }
      @if (disabled()) {
        <p class="text-sm text-amber-700 dark:text-amber-300">
          Lớp đã tốt nghiệp không nhận thành viên mới: hãy chuyển về Đang học để import.
        </p>
      }
      @if (fileError()) {
        <p role="alert" class="text-sm font-medium text-red-700 dark:text-red-300">
          {{ fileError() }}
        </p>
      }
      @if (result(); as r) {
        <div role="status" class="space-y-3">
          <p class="text-base text-gray-800 dark:text-gray-100">
            Tổng {{ r.summary.total }} dòng: {{ r.summary.created }} tạo mới,
            {{ r.summary.added }} thêm vào lớp, {{ r.summary.alreadyMember }} đã ở trong lớp,
            {{ r.summary.errors }} lỗi.
          </p>
          @if (passwordRows().length) {
            <p class="text-base font-semibold text-amber-800 dark:text-amber-300">
              Mật khẩu tạm chỉ có trong phiên này và biến mất khi bạn rời trang hoặc đăng xuất. Hãy
              tải về ngay.
            </p>
            <div class="flex flex-wrap gap-2">
              <button type="button" class="btn-secondary" (click)="downloadPasswords()">
                Tải CSV mật khẩu
              </button>
              <button type="button" class="btn-secondary" (click)="copyPasswords()">
                Sao chép mật khẩu
              </button>
            </div>
          }
          <div class="overflow-x-auto">
            <table class="w-full text-left text-base">
              <caption class="sr-only">
                Kết quả nhập học sinh
              </caption>
              <thead>
                <tr>
                  <th scope="col" class="p-2">Dòng</th>
                  <th scope="col" class="p-2">Họ và tên</th>
                  <th scope="col" class="p-2">Số điện thoại</th>
                  <th scope="col" class="p-2">Kết quả</th>
                  <th scope="col" class="p-2">Mật khẩu tạm</th>
                </tr>
              </thead>
              <tbody>
                @for (row of r.results; track row.row) {
                  <tr class="border-t border-gray-200 dark:border-gray-700">
                    <td class="p-2">{{ row.row }}</td>
                    <td class="p-2">{{ row.fullName }}</td>
                    <td class="p-2">{{ row.phoneNumber }}</td>
                    <td class="p-2" [class.text-red-700]="row.status === 'error'">
                      {{ label(row.status) }}{{ row.message ? ': ' + row.message : '' }}
                    </td>
                    <td class="p-2 font-mono">{{ row.temporaryPassword ?? '' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }
    </section>
  `,
  // Haihs: khối import file giống bản gốc (chữ, icon) - end
})
export class ClassImportPanel implements OnDestroy {
  readonly classId = input.required<string>();
  /** Deleted / graduated class: the import is off. */
  readonly disabled = input(false);
  readonly imported = output<void>();
  private readonly api = inject(ClassesApi);
  private readonly alert = inject(AlertService);
  private readonly store = inject(TempPasswordStore);
  protected readonly file = signal<File | null>(null);
  protected readonly fileError = signal('');
  protected readonly busy = signal(false);
  protected readonly result = signal<ImportResponse | null>(null);
  protected readonly passwordRows = computed(() =>
    (this.result()?.results ?? []).filter((r) => r.temporaryPassword),
  );
  protected readonly label = (s: keyof typeof IMPORT_STATUS_LABELS) => IMPORT_STATUS_LABELS[s] ?? s;

  ngOnDestroy(): void {
    this.store.clear(this.classId()); // leaving the page forgets the passwords
  }

  protected downloadTemplate(): void {
    downloadTextFile('mau-danh-sach-hoc-sinh.csv', studentTemplateCsv());
  }

  protected onPick(e: Event): void {
    const f = (e.target as HTMLInputElement).files?.[0] ?? null;
    const checked = validateImportFile(f);
    this.fileError.set(f && !checked.ok ? checked.message : '');
    this.file.set(checked.ok ? f : null);
  }

  protected upload(): void {
    const f = this.file();
    if (!f || this.busy()) return; // single-flight
    const checked = validateImportFile(f);
    if (!checked.ok) return this.fileError.set(checked.message);
    this.busy.set(true);
    this.fileError.set('');
    this.api
      .import(this.classId(), f)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: (r) => {
          this.store.set(this.classId(), r.results); // right away: the server will never show them again
          this.result.set(r);
          this.imported.emit();
        },
        error: (err: unknown) =>
          this.fileError.set(describeClassError(err, 'Không nhập được file.')),
      });
  }

  protected downloadPasswords(): void {
    const rows = this.store.get(this.classId()) ?? this.passwordRows();
    downloadTextFile(`mat-khau-tam-${safeFileName(this.classId())}.csv`, buildPasswordCsv(rows));
  }

  protected async copyPasswords(): Promise<void> {
    const ok = await copyToClipboard(
      buildPasswordCopyText(this.store.get(this.classId()) ?? this.passwordRows()),
    );
    void (ok
      ? this.alert.success('Đã sao chép mật khẩu tạm.')
      : this.alert.error('Không sao chép được.'));
  }
}
