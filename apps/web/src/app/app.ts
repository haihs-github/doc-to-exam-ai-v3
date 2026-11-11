// Created by Haihs on 11/11/2026
// Root component of the web app (placeholder shell until feature tasks land).
// import { Component, signal } from '@angular/core'; // Haihs: đóng code cũ, signal không còn dùng nên lint lỗi no-unused-vars - start - end
import { Component } from '@angular/core';

@Component({
  // imports: [], // Haihs: đóng code cũ, component không import gì - start - end
  selector: 'app-root',
  // styleUrl: './app.css', // Haihs: đóng code cũ, app.css rỗng đã bị xóa khi tối giản scaffold - start - end
  // templateUrl: './app.html', // Haihs: đóng code cũ, app.html là trang placeholder 20KB của CLI - start - end
  template: '<h1 class="page-title">Doc to Exam</h1>', // Haihs: template inline tối giản - start - end
})
export class App {
  // protected readonly title = signal('web'); // Haihs: đóng code cũ, title không được dùng - start - end
}
