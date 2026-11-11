// Created by Haihs on 11/11/2026
// Root component of the web app (placeholder shell until feature tasks land).
// import { Component, signal } from '@angular/core'; // Haihs: đóng code cũ, signal không còn dùng nên lint lỗi no-unused-vars - start - end
// import { Component } from '@angular/core'; // Haihs: đóng code cũ, cần inject/signal cho trạng thái health - start - end
import { Component, inject, signal } from '@angular/core'; // Haihs: cần inject/signal cho trạng thái health - start - end
import { ApiClient } from './core/api-client'; // Haihs: gọi /api/health - start - end
import { errorMessage } from './core/api-errors'; // Haihs: thông báo lỗi tiếng Việt - start - end

@Component({
  // imports: [], // Haihs: đóng code cũ, component không import gì - start - end
  selector: 'app-root',
  // styleUrl: './app.css', // Haihs: đóng code cũ, app.css rỗng đã bị xóa khi tối giản scaffold - start - end
  // templateUrl: './app.html', // Haihs: đóng code cũ, app.html là trang placeholder 20KB của CLI - start - end
  // template: '<h1 class="page-title">Doc to Exam</h1>', // Haihs: template inline tối giản - start - end
  // Haihs: hiển thị tiêu đề + trạng thái API health - start
  // template: '<h1 class="page-title">Doc to Exam</h1>', // đóng code cũ
  template: `
    <main class="flex min-h-screen flex-col items-center justify-center gap-2">
      <h1 class="page-title">Doc to Exam AI</h1>
      <p role="status">{{ status() }}</p>
    </main>
  `,
  // Haihs: hiển thị tiêu đề + trạng thái API health - end
})
export class App {
  // protected readonly title = signal('web'); // Haihs: đóng code cũ, title không được dùng - start - end
  // Haihs: gọi /api/health, giữ trạng thái bằng signal - start
  protected readonly status = signal('Đang kiểm tra API...');

  constructor() {
    inject(ApiClient)
      .get<{ status: string; timestamp: string; service: string }>('/api/health')
      .subscribe({
        next: (d) => this.status.set(d.status === 'OK' ? 'API: OK' : 'API: không sẵn sàng'),
        error: (e) => this.status.set(errorMessage(e)),
      });
  }
  // Haihs: gọi /api/health, giữ trạng thái bằng signal - end
}
