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

const KINDS: { kind: InviteKind; title: string; hint: string }[] = [
  {
    kind: 'student',
    title: 'Link mời học sinh',
    hint: 'Học sinh quét mã hoặc mở link rồi chờ giáo viên duyệt.',
  },
  {
    kind: 'teacher',
    title: 'Link mời giáo viên',
    hint: 'Giáo viên khác mở link để xin vào lớp, bạn duyệt sau.',
  },
];

@Component({
  selector: 'app-class-invite-tab',
  imports: [QrCode, Skeleton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loadError()) {
      <div role="alert" class="text-base text-red-700 dark:text-red-400">
        {{ loadError() }}
        <button type="button" class="ml-2 font-semibold underline" (click)="load()">Thử lại</button>
      </div>
    }
    @if (loading()) {
      <app-skeleton variant="list" />
    } @else if (invite(); as inv) {
      <div class="grid gap-6 md:grid-cols-2">
        @for (k of kinds; track k.kind) {
          @let st = inv[k.kind];
          <section
            class="space-y-3 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800"
            [attr.aria-label]="k.title"
          >
            <h2 class="text-lg font-bold text-gray-900 dark:text-gray-100">{{ k.title }}</h2>
            <p class="text-base text-gray-600 dark:text-gray-400">{{ k.hint }}</p>
            <p class="text-base font-medium" [class.text-red-700]="!st.enabled">
              {{ st.enabled ? 'Đang bật' : 'Đang tắt: link không dùng được' }}
            </p>

            <button
              type="button"
              class="btn-secondary"
              [attr.aria-pressed]="shown()[k.kind]"
              (click)="toggleShown(k.kind)"
            >
              {{ shown()[k.kind] ? 'Ẩn link' : 'Hiện link' }}
            </button>
            @if (shown()[k.kind]) {
              <p class="break-all rounded-lg bg-gray-100 p-3 font-mono text-sm dark:bg-gray-900">
                {{ link(st.token) }}
              </p>
              <app-qr-code [value]="link(st.token)" [size]="160" [label]="k.title" />
              <button type="button" class="btn-secondary" (click)="copy(k.kind, st.token)">
                Sao chép link
              </button>
            }
            <div class="flex flex-wrap gap-2">
              <button
                type="button"
                class="btn-secondary"
                [disabled]="busy()"
                (click)="toggleEnabled(k.kind, !st.enabled)"
              >
                {{ st.enabled ? 'Tắt link' : 'Bật link' }}
              </button>
              <button type="button" class="btn-danger" [disabled]="busy()" (click)="rotate(k.kind)">
                Tạo link mới
              </button>
            </div>
          </section>
        }
      </div>
    }
  `,
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

  protected async copy(kind: InviteKind, token: string): Promise<void> {
    const ok = await copyToClipboard(this.link(token));
    void (ok
      ? this.alert.success('Đã sao chép link.')
      : this.alert.error('Không sao chép được, hãy chọn và sao chép link thủ công.'));
    void kind;
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
      'Link cũ sẽ ngừng dùng được ngay. Người đã có link cũ phải nhận link mới.',
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
