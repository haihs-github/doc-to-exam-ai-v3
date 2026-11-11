// Created by Haihs on 11/11/2026
// Smoke test for the root component.
import { TestBed } from '@angular/core/testing';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
    })
      .compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render title', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    // expect(compiled.querySelector('h1')?.textContent).toContain('Hello, web'); // Haihs: đóng code cũ, placeholder CLI đã bị thay - start - end
    expect(compiled.querySelector('h1')?.textContent).toContain('Doc to Exam'); // Haihs: khớp tiêu đề mới - start - end
  });
});
