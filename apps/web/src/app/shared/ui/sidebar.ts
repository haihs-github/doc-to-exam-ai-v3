// Created by Haihs on 23/11/2026
// <app-sidebar>: thanh bên trái theo vai trò (web: sticky, thu gọn được; điện thoại: menu trượt + scrim).
import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
} from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { ConfirmService } from './confirm-modal';
import { Icon } from './icon';
import { ShellState } from './shell-state';

const LINK =
  'flex min-h-[48px] w-full cursor-pointer items-center gap-3 rounded-lg px-3 text-left text-base font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800';
const ACTIVE = 'bg-primary-100 !text-primary-900 dark:bg-sky-900/50 dark:!text-sky-200';

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'contents',
    '(document:keydown.escape)': 'onEsc()',
    '(keydown.tab)': 'trap($event, false)',
    '(keydown.shift.tab)': 'trap($event, true)',
  }, // contents: để aside sticky theo wrapper của app
  template: `
    @if (shell.hasSidebar()) {
      @if (shell.open()) {
        <div
          class="fixed inset-x-0 bottom-0 top-[var(--nav-h)] z-40 bg-black/40 md:hidden"
          (click)="shell.open.set(false)"
          aria-hidden="true"
        ></div>
      }
      <aside
        id="sidebar"
        aria-label="Thanh bên"
        class="fixed bottom-0 left-0 top-[var(--nav-h)] z-50 flex w-[min(17rem,82%)] flex-col overflow-y-auto border-r border-gray-200 bg-white p-3 shadow-lg transition-transform duration-200 md:sticky md:z-30 md:h-[calc(100dvh-var(--nav-h))] md:shrink-0 md:translate-x-0 md:shadow-none md:visible md:transition-[width] dark:border-gray-700 dark:bg-gray-900"
        [class]="
          (shell.open() ? '' : '-translate-x-full invisible ') +
          (shell.collapsed() ? 'md:w-[4.25rem] md:px-2' : 'md:w-64')
        "
      >
        <nav aria-label="Menu bên" class="flex flex-col gap-1">
          <div
            class="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
            [class]="lbl()"
          >
            Menu
          </div>
          @if (!auth.user()?.mustChangePassword) {
            @for (l of links(); track l.to) {
              <a
                [routerLink]="l.to"
                [class]="link"
                [routerLinkActive]="active"
                ariaCurrentWhenActive="page"
                [title]="l.label"
                [class.md:justify-center]="shell.collapsed()"
                [class.md:px-0]="shell.collapsed()"
              >
                <app-icon [name]="l.icon" svgClass="h-5 w-5" />
                <span [class]="lbl()">{{ l.label }}</span>
              </a>
            }
            <div class="my-2 border-t border-gray-200 dark:border-gray-700"></div>
            <a
              routerLink="/change-password"
              [class]="link"
              [routerLinkActive]="active"
              ariaCurrentWhenActive="page"
              title="Đổi mật khẩu"
              [class.md:justify-center]="shell.collapsed()"
              [class.md:px-0]="shell.collapsed()"
            >
              <app-icon name="lock" svgClass="h-5 w-5" />
              <span [class]="lbl()">Đổi mật khẩu</span>
            </a>
            @if (auth.isTeacher()) {
              <button
                type="button"
                (click)="openApiKey()"
                [title]="keyLabel()"
                [class]="link + ' border ' + (hasKey() ? KEY_OK : KEY_MISSING)"
                [class.md:justify-center]="shell.collapsed()"
                [class.md:px-0]="shell.collapsed()"
              >
                <app-icon name="key-round" svgClass="h-5 w-5" />
                <span [class]="lbl()">{{ keyLabel() }}</span>
              </button>
            }
          }
        </nav>
        <div class="mt-auto border-t border-gray-200 pt-3 dark:border-gray-700">
          <div class="px-3 pb-2 text-sm text-gray-600 dark:text-gray-300" [class]="lbl()">
            <b class="block truncate text-gray-900 dark:text-gray-100">{{
              auth.user()?.fullName
            }}</b>
            {{ auth.isStudent() ? 'Học sinh' : 'Giáo viên' }} · {{ auth.user()?.phoneNumber }}
          </div>
          <button
            type="button"
            (click)="logout()"
            [class]="link"
            title="Đăng xuất"
            [class.md:justify-center]="shell.collapsed()"
            [class.md:px-0]="shell.collapsed()"
          >
            <app-icon name="log-out" svgClass="h-5 w-5" />
            <span [class]="lbl()">Đăng xuất</span>
          </button>
        </div>
      </aside>
    }
  `,
})
export class Sidebar {
  protected readonly shell = inject(ShellState);
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly confirm = inject(ConfirmService);
  private readonly injector = inject(Injector);
  protected readonly link = LINK;
  protected readonly active = ACTIVE;
  protected readonly KEY_OK =
    'border-green-700 bg-green-50 !text-green-900 hover:!bg-green-100 dark:border-green-500 dark:bg-green-900/30 dark:!text-green-200';
  protected readonly KEY_MISSING =
    'border-amber-600 bg-amber-50 !text-amber-900 hover:!bg-amber-100 dark:border-amber-500 dark:bg-amber-900/30 dark:!text-amber-200';
  protected readonly hasKey = () => Boolean(this.auth.user()?.hasApiKey);
  protected readonly keyLabel = () => (this.hasKey() ? 'Gemini API: Đã có Key' : 'Cài đặt API Key');
  /** Nhãn chữ ẩn khi thu gọn (chỉ web). */
  protected readonly lbl = computed(() => (this.shell.collapsed() ? 'md:hidden' : ''));
  protected readonly links = computed(() =>
    this.auth.isStudent()
      ? [
          { to: '/sittings', label: 'Ca thi của tôi', icon: 'clock' },
          { to: '/classes', label: 'Lớp của tôi', icon: 'users' },
        ]
      : [
          { to: '/teacher/templates', label: 'Đề mẫu', icon: 'file-text' },
          { to: '/teacher/sittings', label: 'Ca thi', icon: 'clock' },
          { to: '/teacher/classes', label: 'Lớp học', icon: 'users' },
        ],
  );

  constructor() {
    // Mở menu trượt: focus vào trong; đóng: trả focus về nút mở (chỉ khi từng mở).
    let wasOpen = false;
    effect(() => {
      const open = this.shell.open();
      if (open === wasOpen) return;
      wasOpen = open;
      afterNextRender(
        () =>
          open
            ? document.querySelector<HTMLElement>('#sidebar a, #sidebar button')?.focus()
            : document.getElementById('navToggle')?.focus(),
        { injector: this.injector },
      );
    });
  }

  /** Esc chỉ đóng lớp trên cùng: khi modal đang mở thì để modal xử lý. */
  protected onEsc(): void {
    if (!document.querySelector('[appModalFocus]')) this.shell.open.set(false);
  }

  /** Giữ Tab trong menu trượt (chỉ khi đang mở). */
  protected trap(e: Event, back: boolean): void {
    if (!this.shell.open()) return;
    const items = [...document.querySelectorAll<HTMLElement>('#sidebar a[href], #sidebar button')];
    const edge = items[back ? 0 : items.length - 1];
    if (document.activeElement === edge) {
      e.preventDefault();
      items[back ? items.length - 1 : 0]?.focus();
    }
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
    this.shell.open.set(false);
    this.auth.logout();
    await this.router.navigateByUrl(dest);
  }
}
