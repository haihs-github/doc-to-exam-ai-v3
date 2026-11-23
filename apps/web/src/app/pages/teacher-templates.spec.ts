// Created by Haihs on 23/11/2026
// Specs cho <app-teacher-templates>: khung AI giữa trang, nút chức năng hiện đủ trên web, ⋮ chỉ điện thoại.
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import type { TemplateSummary } from '@doc-to-exam/contract';
import { TemplatesApi } from '../core/templates.api';
import { TeacherTemplates } from './teacher-templates';

const t = { id: 't1', title: 'Đề A', totalQuestions: 3, sittingCount: 1 } as TemplateSummary;

const setup = async () => {
  const api = {
    list: vi.fn().mockReturnValue(of({ items: [t], page: 1, limit: 20, total: 1, totalPages: 1, hasMore: false })),
    duplicate: vi.fn(),
  };
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: TemplatesApi, useValue: api }],
  });
  const f = TestBed.createComponent(TeacherTemplates);
  await f.whenStable();
  return { f, api, el: f.nativeElement as HTMLElement };
};

describe('TeacherTemplates layout', () => {
  it('has the AI frame with big button (no icon), description and supported formats', async () => {
    const { el } = await setup();
    const frame = el.querySelector('section[aria-label="Tạo đề từ file bằng AI"]')!;
    const btn = frame.querySelector('button')!;
    expect(btn.textContent?.trim()).toBe('Tạo đề từ file (AI)');
    expect(btn.querySelector('svg, app-icon')).toBeNull();
    expect(frame.textContent).toContain('Hỗ trợ file PDF, Word (.doc, .docx), TXT · tối đa 20MB');
  });

  it('shows all row actions as buttons on web and the ⋮ menu only below md', async () => {
    const { el, api } = await setup();
    const row = el.querySelector('li')!;
    const web = row.querySelector('div.md\\:flex')!;
    expect(web.textContent).toContain('Sửa');
    expect(web.textContent).toContain('Tạo bản sao');
    expect(web.textContent).toContain('Xóa');
    expect(row.querySelector('span.md\\:hidden app-action-menu')).not.toBeNull();
    api.duplicate.mockReturnValue(of({}));
    ([...web.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Tạo bản sao') as HTMLElement).click();
    expect(api.duplicate).toHaveBeenCalledWith('t1');
  });
});

// Haihs: nút Tạo ca thi từ đề ở mỗi đề đang dùng - start
describe('TeacherTemplates "Tạo ca thi từ đề"', () => {
  it('navigates to the sitting create page with the template preselected', async () => {
    const { el } = await setup();
    const nav = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const web = el.querySelector('li div.md\\:flex')!;
    ([...web.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Tạo ca thi từ đề') as HTMLElement).click();
    expect(nav).toHaveBeenCalledWith(['/teacher/sittings/new'], { queryParams: { templateId: 't1' } });
  });
});
// Haihs: nút Tạo ca thi từ đề ở mỗi đề đang dùng - end
