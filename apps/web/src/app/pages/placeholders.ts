// Created by Haihs on 11/11/2026
// Temporary pages so every route target exists: logged-in home (until M2/M3).
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
      <!-- Haihs: M2 Task 15 - liên kết tới trang lớp thật theo vai trò - start -->
      <p>
        <a
          [routerLink]="auth.user()?.role === 'student' ? '/classes' : '/teacher/classes'"
          class="text-primary-700 dark:text-sky-400 font-semibold hover:underline"
          >{{ auth.user()?.role === 'student' ? 'Lớp của tôi' : 'Lớp học' }}</a
        >
      </p>
      <!-- Haihs: M2 Task 15 - end -->
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
