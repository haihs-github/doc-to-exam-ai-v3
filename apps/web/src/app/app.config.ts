// Created by Haihs on 11/11/2026
// Application-level providers.
import { provideHttpClient } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(), // Haihs: ApiClient cần HttpClient - start - end
  ]
};
