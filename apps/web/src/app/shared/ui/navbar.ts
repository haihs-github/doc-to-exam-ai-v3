// Created by Haihs on 11/11/2026
// <app-navbar>: sticky top bar with links by role, theme toggle, teacher API-key button, logout (port of Navbar.jsx).
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../../core/auth.service';
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
  imports: [RouterLink, RouterLinkActive, ThemeToggle],
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
              <a routerLink="/about" [class]="link" [routerLinkActive]="active">Giới thiệu</a>
              <app-theme-toggle />
              <a routerLink="/login" [class]="link" [routerLinkActive]="active">Đăng nhập</a>
              <a routerLink="/register" [class]="link" [routerLinkActive]="active">Đăng ký</a>
              <a routerLink="/teacher/login" [class]="link" [routerLinkActive]="active"
                >Giáo viên</a
              >
            } @else {
              @if (!auth.user()?.mustChangePassword) {
                @if (auth.isStudent()) {
                  <!-- TODO(web): M2/M3 — route chưa tồn tại -->
                  <a routerLink="/sittings" [class]="link" [routerLinkActive]="active"
                    >Ca thi của tôi</a
                  >
                  <a routerLink="/classes" [class]="link" [routerLinkActive]="active"
                    >Lớp của tôi</a
                  >
                } @else {
                  <!-- TODO(web): M2/M3 — route chưa tồn tại -->
                  <a routerLink="/teacher/templates" [class]="link" [routerLinkActive]="active"
                    >Đề mẫu</a
                  >
                  <a routerLink="/teacher/sittings" [class]="link" [routerLinkActive]="active"
                    >Ca thi</a
                  >
                  <a routerLink="/teacher/classes" [class]="link" [routerLinkActive]="active"
                    >Lớp học</a
                  >
                }
                <a routerLink="/change-password" [class]="link" [routerLinkActive]="active"
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

  protected logout(): void {
    this.auth.logout();
    void this.router.navigateByUrl('/');
  }
}
