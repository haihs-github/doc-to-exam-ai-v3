// Created by Haihs on 23/11/2026
// ShellState: trạng thái khung (sidebar đóng/mở trên điện thoại, thu gọn trên web) + khi nào hiện sidebar.
import { Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../../core/auth.service';

/** Student exam pages (/ca/*) hide the navbar, except the result page (source Navbar.jsx Pha 4G). */
export const navbarVisible = (url: string): boolean => {
  const path = url.split(/[?#]/)[0];
  return !(path.startsWith('/ca/') && !/^\/ca\/[^/]+\/result\/?$/.test(path));
};

@Injectable({ providedIn: 'root' })
export class ShellState {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly url = signal(this.router.url);
  /** Thu gọn (chỉ web >=768px); giữ trong phiên vì service sống suốt phiên. */
  readonly collapsed = signal(false);
  /** Menu trượt đang mở (điện thoại <768px). */
  readonly open = signal(false);
  /** Khách: chỉ navbar. Đăng nhập: navbar + sidebar. Phòng thi: không có gì. */
  readonly hasSidebar = computed(() => this.auth.isAuthenticated() && navbarVisible(this.url()));

  constructor() {
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((e) => {
        this.url.set(e.urlAfterRedirects);
        this.open.set(false);
      });
  }

  toggleCollapsed(): void {
    this.collapsed.update((v) => !v);
  }
  toggleOpen(): void {
    this.open.update((v) => !v);
  }
}
