// Created by Haihs on 11/11/2026
// <app-api-health>: M0 health status (/api/health result), extracted from the old root component; mounted on About (Task 13b).
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiClient } from '../core/api-client';
import { errorMessage } from '../core/api-errors';

@Component({
  selector: 'app-api-health',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Embedded in About (the shell owns <main>/<h1>), so only the status line is rendered.
  template: `<p role="status" class="text-base text-gray-700 dark:text-gray-200">{{ text() }}</p>`,
})
export class ApiHealth {
  protected readonly state = signal<'loading' | 'ok' | 'error'>('loading');
  private readonly error = signal('');
  protected readonly text = computed(() =>
    this.state() === 'loading'
      ? 'Đang kiểm tra API...'
      : this.state() === 'ok'
        ? 'API: OK'
        : this.error(),
  );

  constructor() {
    inject(ApiClient)
      .get<{ status: string; timestamp: string; service: string }>('/api/health')
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (d) => {
          if (d.status === 'OK') this.state.set('ok');
          else {
            this.error.set('API: không sẵn sàng');
            this.state.set('error');
          }
        },
        error: (e) => {
          this.error.set(errorMessage(e));
          this.state.set('error');
        },
      });
  }
}
