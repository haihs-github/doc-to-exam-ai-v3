// Created by Haihs on 12/11/2026
// <app-join-class> at /join (paste a link or token) and /join/:token (joins once). Port of JoinClass.jsx.
import { ChangeDetectionStrategy, Component, OnDestroy, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../core/auth.service';
import { ClassesApi } from '../core/classes.api';
import type { ClassDto } from '@doc-to-exam/contract';
import { describeClassError } from '../shared/utils/class-ui';
import { parseInviteToken } from '../shared/utils/invite-token';

// Every invalid / disabled / rotated / deleted-class token gets this one neutral text (no enumeration).
const INVALID = 'Link mời không hợp lệ hoặc đã hết hiệu lực. Hãy xin giáo viên link mới.';

@Component({
  selector: 'app-join-class',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-lg space-y-5 px-4 py-10">
      <h1 class="text-2xl font-extrabold text-gray-900 dark:text-gray-100">Tham gia lớp</h1>
      @if (token) {
        @if (busy()) {
          <p role="status" class="text-base text-gray-600 dark:text-gray-400">
            Đang tham gia lớp...
          </p>
        } @else if (error()) {
          <p role="alert" class="text-base font-medium text-red-700 dark:text-red-400">
            {{ error() }}
          </p>
          <a routerLink="/join" class="btn-secondary inline-flex">Nhập link khác</a>
        } @else if (joined(); as c) {
          <div role="status" class="space-y-3">
            @if (c.membershipStatus === 'approved') {
              <p class="text-base">
                Bạn đã ở trong lớp <strong>{{ c.name }}</strong
                >.
              </p>
            } @else {
              <p class="text-base">
                Đã gửi yêu cầu vào lớp <strong>{{ c.name }}</strong
                >. Hãy chờ giáo viên duyệt.
              </p>
            }
            <a [routerLink]="home()" class="btn-primary inline-flex">Về danh sách lớp</a>
          </div>
        }
      } @else {
        <form (submit)="submit($event)" novalidate class="space-y-3">
          <label
            for="join-input"
            class="block text-base font-medium text-gray-800 dark:text-gray-200"
            >Dán link mời hoặc mã mời</label
          >
          <input
            id="join-input"
            name="invite"
            class="input"
            autocomplete="off"
            [value]="value()"
            (input)="onInput($event)"
          />
          @if (error()) {
            <p role="alert" class="text-sm font-medium text-red-700 dark:text-red-300">
              {{ error() }}
            </p>
          }
          <button type="submit" class="btn-primary">Tiếp tục</button>
        </form>
      }
    </div>
  `,
})
export class JoinClass implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(ClassesApi);
  private readonly auth = inject(AuthService);
  protected readonly token = this.route.snapshot.paramMap.get('token');
  protected readonly value = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly joined = signal<ClassDto | null>(null);
  private sub?: Subscription;

  constructor() {
    // Exactly one request per page load, however often the view re-renders.
    if (this.token) this.join(this.token);
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  protected home(): string {
    return this.auth.user()?.role === 'teacher' ? '/teacher/classes' : '/classes';
  }

  private join(token: string): void {
    if (!parseInviteToken(token)) {
      this.error.set(INVALID);
      return;
    }
    this.busy.set(true);
    this.sub = this.api.join(token).subscribe({
      next: (c) => {
        this.joined.set(c);
        this.busy.set(false);
      },
      error: (e: unknown) => {
        const code = (e as { code?: string }).code;
        this.error.set(
          code === 'INVITE_INVALID' ? INVALID : describeClassError(e, 'Không tham gia được lớp.'),
        );
        this.busy.set(false);
      },
    });
  }

  protected onInput(e: Event): void {
    this.value.set((e.target as HTMLInputElement).value);
    this.error.set('');
  }

  protected submit(e: Event): void {
    e.preventDefault();
    const t = parseInviteToken(this.value());
    if (!t) return this.error.set('Link hoặc mã mời không đúng định dạng.');
    void this.router.navigate(['/join', t]);
  }
}
