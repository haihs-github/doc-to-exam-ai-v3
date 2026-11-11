// Created by Haihs on 11/11/2026
// Temporary pages so every route target exists: logged-in home (until M2/M3) and About (until Task 13b).
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';

// TODO(web): M2/M3 thay bằng trang thật (/sittings cho học sinh, /teacher/templates cho giáo viên)
@Component({
  selector: 'app-home-placeholder',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-md px-4 py-10 space-y-3">
      <h1 class="text-xl font-extrabold text-gray-900 dark:text-gray-100">
        Xin chào, {{ auth.user()?.fullName }}
      </h1>
      <p class="text-base text-gray-600 dark:text-gray-400">Các trang chính đang được xây dựng.</p>
      <p>
        <a
          routerLink="/change-password"
          class="text-primary-700 dark:text-sky-400 font-semibold hover:underline"
          >Đổi mật khẩu</a
        >
      </p>
    </div>
  `,
})
export class HomePlaceholder {
  protected readonly auth = inject(AuthService);
}

// TODO(web): Task 13b thay bằng trang About thật (và gắn <app-api-health> vào đó)
@Component({
  selector: 'app-about-placeholder',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-md px-4 py-10">
      <h1 class="text-xl font-extrabold text-gray-900 dark:text-gray-100">Giới thiệu</h1>
    </div>
  `,
})
export class AboutPlaceholder {}
