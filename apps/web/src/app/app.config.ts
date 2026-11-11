// Created by Haihs on 11/11/2026
// Application-level providers.
import { provideHttpClient } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router'; // Haihs: thêm router cho các route auth của M1 (plan Task 10/13) - start - end

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(), // Haihs: ApiClient cần HttpClient - start - end
    provideRouter([]), // Haihs: thêm router cho các route auth của M1 (plan Task 10/13) - start - end
  ]
};
