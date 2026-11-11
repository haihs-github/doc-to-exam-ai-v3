// Created by Haihs on 11/11/2026
// Application-level providers.
import { provideHttpClient } from '@angular/common/http';
import { withInterceptors } from '@angular/common/http';
import { authInterceptor } from './core/auth.interceptor';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router'; // Haihs: thêm router cho các route auth của M1 (plan Task 10/13) - start - end

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Haihs: gắn authInterceptor (Bearer, 401/403, đếm request) vào HttpClient - start
    // đóng code cũ
    // provideHttpClient(), // Haihs: ApiClient cần HttpClient - start - end
    provideHttpClient(withInterceptors([authInterceptor])),
    // Haihs: gắn authInterceptor (Bearer, 401/403, đếm request) vào HttpClient - end
    provideRouter([]), // Haihs: thêm router cho các route auth của M1 (plan Task 10/13) - start - end
  ]
};
