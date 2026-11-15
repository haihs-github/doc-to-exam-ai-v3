// Created by Haihs on 12/11/2026
// <app-class-invite-tab>: invite links (student / teacher) with QR, copy, rotate and on/off. Port of ClassInviteTab.jsx.
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  inject,
  input,
  signal,
} from '@angular/core';
import type { InviteDto } from '@doc-to-exam/contract';
import { Subscription, finalize } from 'rxjs';
import { ClassesApi, InviteKind } from '../../core/classes.api';
import { copyToClipboard } from '../utils/browser';
import { describeClassError } from '../utils/class-ui';
import { AlertService } from './alert.service';
import { ConfirmService } from './confirm-modal';
import { QrCode } from './qr-code';
import { Skeleton } from './skeleton';
import { Icon } from './icon';

const KINDS: { kind: InviteKind; title: string; hint: string }[] = [
  {
    kind: 'student',
    // Haihs: tab link mời giống bản gốc (link luôn hiện, Đang nhận thêm, cảnh báo) - start
    // đóng code cũ
    // title: 'Link mời học sinh',
    // hint: 'Học sinh quét mã hoặc mở link rồi chờ giáo viên duyệt.',
    title: 'Mời học sinh',
    hint: 'Học sinh có link sẽ vào hàng chờ và cần giáo viên duyệt.',
    // Haihs: tab link mời giống bản gốc (link luôn hiện, Đang nhận thêm, cảnh báo) - end
  },
  {
    kind: 'teacher',
    // Haihs: tab link mời giống bản gốc (link luôn hiện, Đang nhận thêm, cảnh báo) - start
    // đóng code cũ
    // title: 'Link mời giáo viên',
    // hint: 'Giáo viên khác mở link để xin vào lớp, bạn duyệt sau.',
    title: 'Mời giáo viên',
    hint: 'Cảnh báo: nếu link này bị lộ, bất kỳ ai có tài khoản giáo viên đều vào được hàng chờ. Chỉ duyệt khi đã đối chiếu tên và số điện thoại; tắt hoặc đổi link bất cứ lúc nào.',
    // Haihs: tab link mời giống bản gốc (link luôn hiện, Đang nhận thêm, cảnh báo) - end
  },
];

@Component({
  selector: 'app-class-invite-tab',
  // Haihs: icon cho nút giống bản gốc - start
  // đóng code cũ
  // Haihs: khung báo lỗi có icon giống bản gốc - start
  // đóng code cũ
  // // imports: [QrCode, Skeleton],
  // imports: [QrCode, Skeleton, Icon],
  // Haihs: khung báo lỗi có icon giống bản gốc - end
  imports: [QrCode, Skeleton, Icon],
  // Haihs: icon cho nút giống bản gốc - end
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Haihs: tab link mời giống bản gốc (link luôn hiện, Đang nhận thêm, cảnh báo) - start
  // đóng code cũ
  //   template: `
  //     @if (loadError()) {
  //       <!-- Haihs: khung báo lỗi có icon giống bản gốc - start -->
  //       <!-- đóng code cũ -->
  //       <!-- <div role="alert" class="text-base text-red-700 dark:text-red-400"> -->
  //       <!-- {{ loadError() }} -->
  //       <!-- <button type="button" class="ml-2 font-semibold underline" (click)="load()">Thử lại</button> -->
  //       <div
  //         role="alert"
  //         class="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-base text-red-700 dark:border-red-800 dark:bg-red-900/40 dark:text-red-300"
  //       >
  //         <app-icon name="alert-circle" class="mt-0.5 flex-none" svgClass="h-4 w-4" />
  //         <span>{{ loadError() }}</span>
  //         <button type="button" class="ml-auto font-semibold underline" (click)="load()">
  //           Thử lại
  //         </button>
  //         <!-- Haihs: khung báo lỗi có icon giống bản gốc - end -->
  //       </div>
  //     }
  //     @if (loading()) {
  //       <app-skeleton variant="list" />
  //     } @else if (invite(); as inv) {
  //       <div class="grid gap-6 md:grid-cols-2">
  //         @for (k of kinds; track k.kind) {
  //           @let st = inv[k.kind];
  //           <section
  //             class="space-y-3 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800"
  //             [attr.aria-label]="k.title"
  //           >
  //             <h2 class="text-lg font-bold text-gray-900 dark:text-gray-100">{{ k.title }}</h2>
  //             <p class="text-base text-gray-600 dark:text-gray-400">{{ k.hint }}</p>
  //             <p class="text-base font-medium" [class.text-red-700]="!st.enabled">
  //               {{ st.enabled ? 'Đang bật' : 'Đang tắt: link không dùng được' }}
  //             </p>

  //             <button
  //               type="button"
  //               class="btn-secondary"
  //               [attr.aria-pressed]="shown()[k.kind]"
  //               (click)="toggleShown(k.kind)"
  //             >
  //               {{ shown()[k.kind] ? 'Ẩn link' : 'Hiện link' }}
  //             </button>
  //             @if (shown()[k.kind]) {
  //               <p class="break-all rounded-lg bg-gray-100 p-3 font-mono text-sm dark:bg-gray-900">
  //                 {{ link(st.token) }}
  //               </p>
  //               <app-qr-code [value]="link(st.token)" [size]="160" [label]="k.title" />
  //               <button type="button" class="btn-secondary" (click)="copy(k.kind, st.token)">
  //                 Sao chép link
  //               </button>
  //             }
  //             <div class="flex flex-wrap gap-2">
  //               <button
  //                 type="button"
  //                 class="btn-secondary"
  //                 [disabled]="busy()"
  //                 (click)="toggleEnabled(k.kind, !st.enabled)"
  //               >
  //                 {{ st.enabled ? 'Tắt link' : 'Bật link' }}
  //               </button>
  //               <button type="button" class="btn-danger" [disabled]="busy()" (click)="rotate(k.kind)">
  //                 <!-- Haihs: icon cho nút giống bản gốc - start -->
  //                 <!-- đóng code cũ -->
  //                 <!-- Tạo link mới -->
  //                 <app-icon name="refresh-cw" svgClass="h-4 w-4" /> Tạo link mới
  //                 <!-- Haihs: icon cho nút giống bản gốc - end -->
  //               </button>
  //             </div>
  //           </section>
  //         }
  //       </div>
  //     }
  //   `,
  template: `
    @if (loadError()) {
      <!-- Haihs: khung báo lỗi có icon giống bản gốc - start -->
      <!-- đóng code cũ -->
      <!-- <div role="alert" class="text-base text-red-700 dark:text-red-400"> -->
      <!-- {{ loadError() }} -->
      <!-- <button type="button" class="ml-2 font-semibold underline" (click)="load()">Thử lại</button> -->
      <div
        role="alert"
        class="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-base text-red-700 dark:border-red-800 dark:bg-red-900/40 dark:text-red-300"
      >
        <app-icon name="alert-circle" class="mt-0.5 flex-none" svgClass="h-4 w-4" />
        <span>{{ loadError() }}</span>
        <button type="button" class="ml-auto font-semibold underline" (click)="load()">
          Thử lại
        </button>
        <!-- Haihs: khung báo lỗi có icon giống bản gốc - end -->
      </div>
    }
    @if (loading()) {
      <app-skeleton variant="list" />
    } @else if (invite(); as inv) {
      <div class="space-y-4">
        @for (k of kinds; track k.kind) {
          @let st = inv[k.kind];
          <section
            class="space-y-3 rounded-xl border border-gray-200 bg-white p-5 shadow-raised dark:border-gray-700 dark:bg-gray-800 dark:shadow-raised-dark"
            [attr.aria-label]="k.title"
          >
            <div class="flex items-center justify-between gap-3">
              <h3 class="font-bold text-gray-800 dark:text-gray-100">{{ k.title }}</h3>
              <label class="flex items-center gap-2 text-base text-gray-700 dark:text-gray-200">
                <input
                  type="checkbox"
                  [checked]="st.enabled"
                  [disabled]="busy()"
                  (change)="toggleEnabled(k.kind, $any($event.target).checked)"
                />
                Đang nhận thêm
              </label>
            </div>
            <p class="text-sm text-gray-500 dark:text-gray-400">{{ k.hint }}</p>
            <div class="flex flex-col items-start gap-4 sm:flex-row">
              <app-qr-code [value]="link(st.token)" [size]="128" [label]="k.title" />
              <div class="w-full flex-1 space-y-2">
                <input
                  readonly
                  [value]="link(st.token)"
                  (focus)="$any($event.target).select()"
                  class="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 font-mono text-sm dark:border-gray-600 dark:bg-gray-900"
                  [attr.aria-label]="'Link ' + k.title"
                />
                <div class="flex flex-wrap gap-2">
                  <button
                    type="button"
                    (click)="copy(k.kind, st.token)"
                    class="flex items-center gap-1.5 rounded-lg border border-primary-200 px-3 py-1.5 text-base font-semibold text-primary-800 hover:bg-primary-50 dark:border-sky-800 dark:text-sky-400 dark:hover:bg-sky-900/30"
                  >
                    <app-icon name="copy" svgClass="h-4 w-4" />
                    {{ copiedKind() === k.kind ? 'Đã sao chép' : 'Sao chép' }}
                  </button>
                  <button
                    type="button"
                    [disabled]="busy()"
                    (click)="rotate(k.kind)"
                    class="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-base font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                  >
                    <app-icon name="refresh-cw" svgClass="h-4 w-4" /> Tạo link mới
                  </button>
                </div>
                @if (copyFailed() === k.kind) {
                  <p class="text-sm text-red-600 dark:text-red-400">
                    Không sao chép tự động được, hãy chọn ô link và sao chép thủ công.
                  </p>
                }
              </div>
            </div>
          </section>
        }
      </div>
    }
  `,
  // Haihs: tab link mời giống bản gốc (link luôn hiện, Đang nhận thêm, cảnh báo) - end
})
export class ClassInviteTab implements OnDestroy {
  readonly classId = input.required<string>();
  private readonly api = inject(ClassesApi);
  private readonly alert = inject(AlertService);
  private readonly confirm = inject(ConfirmService);
  protected readonly kinds = KINDS;
  protected readonly invite = signal<InviteDto | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadError = signal('');
  protected readonly busy = signal(false);
  protected readonly shown = signal<Record<InviteKind, boolean>>({
    student: false,
    teacher: false,
  });
  private sub?: Subscription;

  constructor() {
    queueMicrotask(() => this.load());
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  /** Same-origin link (D13): the token only ever lives in memory and in this text, never in the browser URL. */
  protected link(token: string): string {
    return `${window.location.origin}/join/${token}`;
  }

  protected load(): void {
    this.sub?.unsubscribe();
    this.loading.set(true);
    this.loadError.set('');
    this.sub = this.api.invite(this.classId()).subscribe({
      next: (i) => {
        this.invite.set(i);
        this.loading.set(false);
      },
      error: (e: unknown) => {
        this.loadError.set(describeClassError(e, 'Không tải được link mời.'));
        this.loading.set(false);
      },
    });
  }

  protected toggleShown(kind: InviteKind): void {
    this.shown.update((s) => ({ ...s, [kind]: !s[kind] }));
  }

  // Haihs: tab link mời giống bản gốc (link luôn hiện, Đang nhận thêm, cảnh báo) - start
  protected readonly copiedKind = signal<InviteKind | null>(null);
  protected readonly copyFailed = signal<InviteKind | null>(null);

  // Haihs: tab link mời giống bản gốc (link luôn hiện, Đang nhận thêm, cảnh báo) - end
  protected async copy(kind: InviteKind, token: string): Promise<void> {
    const ok = await copyToClipboard(this.link(token));
    // Haihs: tab link mời giống bản gốc (link luôn hiện, Đang nhận thêm, cảnh báo) - start
    // đóng code cũ
    // void (ok
    // ? this.alert.success('Đã sao chép link.')
    // : this.alert.error('Không sao chép được, hãy chọn và sao chép link thủ công.'));
    // void kind;
    this.copyFailed.set(ok ? null : kind);
    this.copiedKind.set(ok ? kind : null);
    if (ok) setTimeout(() => this.copiedKind.set(null), 2000);
    // Haihs: tab link mời giống bản gốc (link luôn hiện, Đang nhận thêm, cảnh báo) - end
  }

  protected toggleEnabled(kind: InviteKind, enabled: boolean): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.api
      .setInviteEnabled(this.classId(), kind, enabled)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: (inv) => this.invite.set(inv), // the API answers with both links
        error: (e: unknown) =>
          void this.alert.error(describeClassError(e, 'Không đổi được trạng thái link.')),
      });
  }

  protected async rotate(kind: InviteKind): Promise<void> {
    const ok = await this.confirm.confirm(
      // Haihs: tab link mời giống bản gốc (link luôn hiện, Đang nhận thêm, cảnh báo) - start
      // đóng code cũ
      // 'Link cũ sẽ ngừng dùng được ngay. Người đã có link cũ phải nhận link mới.',
      'Link cũ (và mã QR cũ) sẽ vô hiệu ngay. Những người đã xin vào lớp không bị ảnh hưởng.',
      // Haihs: tab link mời giống bản gốc (link luôn hiện, Đang nhận thêm, cảnh báo) - end
      { title: 'Tạo link mới?', confirmText: 'Tạo link mới', cancelText: 'Hủy', danger: true },
    );
    if (!ok || this.busy()) return;
    this.busy.set(true);
    this.api
      .rotateInvite(this.classId(), kind)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: (inv) => {
          this.invite.set(inv); // QR re-renders from the new token
          void this.alert.success('Đã tạo link mới.');
        },
        error: (e: unknown) =>
          void this.alert.error(describeClassError(e, 'Không tạo được link mới.')),
      });
  }
}
