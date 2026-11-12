// Created by Haihs on 11/11/2026
// Application-level providers.
import { provideHttpClient } from '@angular/common/http';
import { withInterceptors } from '@angular/common/http';
import { authInterceptor } from './core/auth.interceptor';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router'; // Haihs: thêm router cho các route auth của M1 (plan Task 10/13) - start - end
import { routes } from './app.routes';
import { inject, provideEnvironmentInitializer } from '@angular/core';
import { SessionNavigation } from './core/session-navigation';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Haihs: gắn authInterceptor (Bearer, 401/403, đếm request) vào HttpClient - start
    // đóng code cũ
    // provideHttpClient(), // Haihs: ApiClient cần HttpClient - start - end
    provideHttpClient(withInterceptors([authInterceptor])),
    // Haihs: gắn authInterceptor (Bearer, 401/403, đếm request) vào HttpClient - end
    // Haihs: nối bảng route thật (login/register/change-password/session-error...) thay cho bảng rỗng - start
    // đóng code cũ
    // provideRouter([]), // Haihs: thêm router cho các route auth của M1 (plan Task 10/13) - start - end
    provideRouter(routes),
    // Haihs: nối bảng route thật (login/register/change-password/session-error...) thay cho bảng rỗng - end
    // Haihs: khởi tạo SessionNavigation để mất phiên/buộc đổi mật khẩu giữa chừng tự điều hướng - start
    provideEnvironmentInitializer(() => {
      inject(SessionNavigation);
    }),
    // Haihs: khởi tạo SessionNavigation để mất phiên/buộc đổi mật khẩu giữa chừng tự điều hướng - end
  ]
};
