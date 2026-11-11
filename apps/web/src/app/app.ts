// Created by Haihs on 11/11/2026
// Root component of the web app (placeholder shell until feature tasks land).
// import { Component, signal } from '@angular/core'; // Haihs: đóng code cũ, signal không còn dùng nên lint lỗi no-unused-vars - start - end
// import { Component } from '@angular/core'; // Haihs: đóng code cũ, cần inject/signal cho trạng thái health - start - end
// Haihs: shell: tách trạng thái health sang pages/api-health.ts, app.ts chỉ còn vỏ ứng dụng (Task 13a) - start
// đóng code cũ
// import { Component, computed, inject, signal } from '@angular/core'; // Haihs: cần computed/inject/signal cho trạng thái health - start - end
// import { takeUntilDestroyed } from '@angular/core/rxjs-interop'; // Haihs: tự hủy subscription khi destroy - start - end
// import { ApiClient } from './core/api-client'; // Haihs: gọi /api/health - start - end
// import { errorMessage } from './core/api-errors'; // Haihs: thông báo lỗi tiếng Việt - start - end
import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AlertHost } from './shared/ui/alert-modal';
import { ApiKeyModal } from './shared/ui/api-key-modal';
import { ApiProgress } from './shared/ui/api-progress';
import { ConfirmHost } from './shared/ui/confirm-modal';
import { Navbar } from './shared/ui/navbar';
// Haihs: shell: tách trạng thái health sang pages/api-health.ts, app.ts chỉ còn vỏ ứng dụng (Task 13a) - end

@Component({
  // imports: [], // Haihs: đóng code cũ, component không import gì - start - end
  // imports: [ApiProgress, Navbar, RouterOutlet, AlertHost, ConfirmHost], // Haihs: đóng code cũ, thêm modal API Key vào vỏ ứng dụng (Task 13b) - start - end
  imports: [ApiProgress, Navbar, RouterOutlet, AlertHost, ConfirmHost, ApiKeyModal], // Haihs: vỏ ứng dụng cần các thành phần UI chung, thêm modal API Key (Task 13b) - start - end
  selector: 'app-root',
  // styleUrl: './app.css', // Haihs: đóng code cũ, app.css rỗng đã bị xóa khi tối giản scaffold - start - end
  // templateUrl: './app.html', // Haihs: đóng code cũ, app.html là trang placeholder 20KB của CLI - start - end
  // Haihs: hiển thị tiêu đề + trạng thái API health - start
  // đóng code cũ
  // template: '<h1 class="page-title">Doc to Exam</h1>', // Haihs: template inline tối giản - start - end
  // template: `
  //   <main class="flex min-h-screen flex-col items-center justify-center gap-2">
  //     <h1 class="page-title">Doc to Exam AI</h1>
  //     <p role="status">{{ text() }}</p>
  //   </main>
  // `,
  template: `
    <app-api-progress />
    <app-navbar />
    <main id="main">
      <router-outlet />
    </main>
    <app-alert-host />
    <app-confirm-host />
    <app-api-key-modal />
  `,
  // Haihs: hiển thị tiêu đề + trạng thái API health - end
})
export class App {
  // protected readonly title = signal('web'); // Haihs: đóng code cũ, title không được dùng - start - end
  // Haihs: gọi /api/health, giữ trạng thái bằng signal - start
  // đóng code cũ
  // protected readonly state = signal<'loading' | 'ok' | 'error'>('loading');
  // private readonly error = signal('');
  // protected readonly text = computed(() =>
  //   this.state() === 'loading' ? 'Đang kiểm tra API...' : this.state() === 'ok' ? 'API: OK' : this.error());

  // constructor() {
  //   inject(ApiClient)
  //     .get<{ status: string; timestamp: string; service: string }>('/api/health')
  //     .pipe(takeUntilDestroyed())
  //     .subscribe({
  //       next: (d) => {
  //         if (d.status === 'OK') this.state.set('ok');
  //         else { this.error.set('API: không sẵn sàng'); this.state.set('error'); }
  //       },
  //       error: (e) => { this.error.set(errorMessage(e)); this.state.set('error'); },
  //     });
  // }
  // Haihs: gọi /api/health, giữ trạng thái bằng signal - end
}
