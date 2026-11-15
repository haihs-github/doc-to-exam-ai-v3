// Created by Haihs on 11/11/2026
// <app-navbar>: sticky top bar with links by role, theme toggle, teacher API-key button, logout (port of Navbar.jsx).
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { ConfirmService } from './confirm-modal';
import { Icon } from './icon';
import { ThemeToggle } from './theme-toggle';

/** Student exam pages (/ca/*) hide the navbar, except the result page (source Navbar.jsx Pha 4G). */
export const navbarVisible = (url: string): boolean => {
  const path = url.split(/[?#]/)[0];
  return !(path.startsWith('/ca/') && !/^\/ca\/[^/]+\/result\/?$/.test(path));
};

const LINK =
  'flex min-h-[48px] items-center gap-2 rounded-lg px-3 text-base font-medium transition-colors text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800';
const ACTIVE = 'bg-primary-100 !text-primary-900 dark:bg-sky-900/50 dark:!text-sky-200';

@Component({
  selector: 'app-navbar',
  // imports: [RouterLink, RouterLinkActive, ThemeToggle], // Haihs: đóng code cũ, thêm Icon cho nút Đăng Nhập/Đăng Ký - start - end
  imports: [RouterLink, RouterLinkActive, ThemeToggle, Icon], // Haihs: thêm Icon cho nút Đăng Nhập/Đăng Ký - start - end
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <header
        class="sticky top-0 z-40 h-[var(--nav-h)] border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
      >
        <div
          class="flex h-full w-full items-center justify-between gap-2 px-4 sm:px-6 2xl:mx-auto 2xl:max-w-[1920px]"
        >
          <a routerLink="/" class="flex min-h-[48px] shrink-0 items-center gap-2.5 rounded-lg">
            <span class="text-lg font-semibold tracking-tight text-gray-900 dark:text-gray-100"
              >DocToExam<span class="text-primary-700 dark:text-sky-400"> AI</span></span
            >
          </a>
          <nav
            aria-label="Điều hướng chính"
            class="flex min-w-0 flex-nowrap items-center gap-1 overflow-x-auto sm:gap-2 [&>*]:shrink-0"
          >
            @if (!auth.isAuthenticated()) {
              <!-- TODO(web): M4 — route /about chưa tồn tại -->
              <!-- Haihs: đã xử lý, route /about đã có ở app.routes.ts - start - end -->
              <!-- Haihs: header khách giống bản cũ: bỏ Giới thiệu/Giáo viên, nút Đăng Nhập + Đăng Ký có icon - start -->
              <!-- đóng code cũ -->
              <!-- <a -->
              <!-- routerLink="/about" -->
              <!-- [class]="link" -->
              <!-- [routerLinkActive]="active" -->
              <!-- ariaCurrentWhenActive="page" -->
              <!-- >Giới thiệu</a -->
              <!-- > -->
              <!-- <app-theme-toggle /> -->
              <!-- <a -->
              <!-- routerLink="/login" -->
              <!-- [class]="link" -->
              <!-- [routerLinkActive]="active" -->
              <!-- ariaCurrentWhenActive="page" -->
              <!-- >Đăng nhập</a -->
              <!-- > -->
              <!-- <a -->
              <!-- routerLink="/register" -->
              <!-- [class]="link" -->
              <!-- [routerLinkActive]="active" -->
              <!-- ariaCurrentWhenActive="page" -->
              <!-- >Đăng ký</a -->
              <!-- > -->
              <!-- <a -->
              <!-- routerLink="/teacher/login" -->
              <!-- [class]="link" -->
              <!-- [routerLinkActive]="active" -->
              <!-- ariaCurrentWhenActive="page" -->
              <!-- >Giáo viên</a -->
              <!-- > -->
              <app-theme-toggle />
              <a routerLink="/teacher/login" class="btn-ghost">
                <app-icon name="login" svgClass="h-5 w-5" />
                <span>Đăng Nhập</span>
              </a>
              <a routerLink="/teacher/register" class="btn-primary">
                <app-icon name="userplus" svgClass="h-5 w-5" />
                <span>Đăng Ký</span>
              </a>
              <!-- Haihs: header khách giống bản cũ: bỏ Giới thiệu/Giáo viên, nút Đăng Nhập + Đăng Ký có icon - end -->
            } @else {
              @if (!auth.user()?.mustChangePassword) {
                @if (auth.isStudent()) {
                  <!-- TODO(web): M2/M3 — route chưa tồn tại -->
                  <a
                    routerLink="/sittings"
                    [class]="link"
                    [routerLinkActive]="active"
                    ariaCurrentWhenActive="page"
                    >Ca thi của tôi</a
                  >
                  <a
                    routerLink="/classes"
                    [class]="link"
                    [routerLinkActive]="active"
                    ariaCurrentWhenActive="page"
                    >Lớp của tôi</a
                  >
                } @else {
                  <!-- TODO(web): M2/M3 — route chưa tồn tại -->
                  <a
                    routerLink="/teacher/templates"
                    [class]="link"
                    [routerLinkActive]="active"
                    ariaCurrentWhenActive="page"
                    >Đề mẫu</a
                  >
                  <a
                    routerLink="/teacher/sittings"
                    [class]="link"
                    [routerLinkActive]="active"
                    ariaCurrentWhenActive="page"
                    >Ca thi</a
                  >
                  <a
                    routerLink="/teacher/classes"
                    [class]="link"
                    [routerLinkActive]="active"
                    ariaCurrentWhenActive="page"
                    >Lớp học</a
                  >
                }
                <a
                  routerLink="/change-password"
                  [class]="link"
                  [routerLinkActive]="active"
                  ariaCurrentWhenActive="page"
                  >Đổi mật khẩu</a
                >
                @if (auth.isTeacher()) {
                  <button
                    type="button"
                    (click)="openApiKey()"
                    class="flex min-h-[48px] cursor-pointer items-center gap-2 rounded-lg border px-3 text-base font-medium transition-colors"
                    [class]="
                      hasKey()
                        ? 'border-green-700 bg-green-50 text-green-900 hover:bg-green-100 dark:border-green-500 dark:bg-green-900/30 dark:text-green-200'
                        : 'border-amber-600 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:border-amber-500 dark:bg-amber-900/30 dark:text-amber-200'
                    "
                  >
                    {{ hasKey() ? 'Gemini API: Đã có Key' : 'Cài đặt API Key' }}
                  </button>
                }
              }
              <app-theme-toggle />
              <div
                class="flex items-center gap-2 border-l border-gray-200 pl-2 dark:border-gray-700"
              >
                <span
                  class="hidden text-base font-medium text-gray-900 xl:inline dark:text-gray-100"
                  >{{ auth.user()?.fullName }}</span
                >
                <button type="button" (click)="logout()" class="btn-ghost" title="Đăng xuất">
                  Đăng xuất
                </button>
              </div>
            }
          </nav>
        </div>
      </header>
    }
  `,
})
export class Navbar {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly confirm = inject(ConfirmService);
  protected readonly link = LINK;
  protected readonly active = ACTIVE;
  protected readonly visible = signal(navbarVisible(this.router.url));
  protected readonly hasKey = () => Boolean(this.auth.user()?.hasApiKey);

  constructor() {
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((e) => this.visible.set(navbarVisible(e.urlAfterRedirects)));
  }

  protected openApiKey(): void {
    window.dispatchEvent(new CustomEvent('open-api-key-modal'));
  }

  /** Asks first (source Navbar.jsx ý 14); afterwards goes to the login page of the role that logged out. */
  protected async logout(): Promise<void> {
    const dest = this.auth.isStudent() ? '/login' : '/teacher/login';
    const ok = await this.confirm.confirm(
      'Bạn có chắc chắn muốn đăng xuất khỏi tài khoản trên thiết bị này không?',
      {
        title: 'Đăng xuất',
        confirmText: 'Đăng xuất',
        cancelText: 'Ở lại',
        danger: true,
      },
    );
    if (!ok) return;
    this.auth.logout();
    await this.router.navigateByUrl(dest);
  }
}
