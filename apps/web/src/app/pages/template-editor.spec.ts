// Created by Haihs on 23/11/2026
// Specs cho nút "Tạo ca thi từ đề" của <app-template-editor>: đề đã lưu chuyển luôn, đề chưa lưu hỏi xác nhận rồi lưu.
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { TemplatesApi } from '../core/templates.api';
import { ConfirmService } from '../shared/ui/confirm-modal';
import { TemplateEditor } from './template-editor';

const detail = {
  id: 't1',
  title: 'Đề A',
  description: '',
  questions: [{ id: 1, context: '', questionText: 'Nội dung câu một', explanation: '', options: { A: 'a', B: 'b', C: 'c', D: 'd' }, correctAnswer: 'A' }],
};

const setup = async (id: string | null) => {
  const api = { get: vi.fn().mockReturnValue(of(detail)), create: vi.fn().mockReturnValue(of({ id: 'new1' })), update: vi.fn().mockReturnValue(of(detail)) };
  const confirm = { confirm: vi.fn().mockResolvedValue(true) };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: TemplatesApi, useValue: api },
      { provide: ConfirmService, useValue: confirm },
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => id } } } },
    ],
  });
  const nav = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  const f = TestBed.createComponent(TemplateEditor);
  await f.whenStable();
  const btn = () => [...(f.nativeElement as HTMLElement).querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Tạo ca thi từ đề')!;
  return { f, api, confirm, nav, btn };
};

describe('TemplateEditor "Tạo ca thi từ đề"', () => {
  it('saved template: goes straight to /teacher/sittings/new?templateId=id, no popup', async () => {
    const s = await setup('t1');
    s.btn().click();
    await s.f.whenStable();
    expect(s.confirm.confirm).not.toHaveBeenCalled();
    expect(s.nav).toHaveBeenCalledWith(['/teacher/sittings/new'], { queryParams: { templateId: 't1' } });
  });

  it('edited but unsaved template: popup, then saves and navigates', async () => {
    const s = await setup('t1');
    const title = (s.f.nativeElement as HTMLElement).querySelector<HTMLInputElement>('input[name="title"]')!;
    title.value = 'Đề A đã sửa';
    title.dispatchEvent(new Event('input'));
    s.btn().click();
    await s.f.whenStable();
    expect(s.confirm.confirm).toHaveBeenCalledOnce();
    expect(s.api.update).toHaveBeenCalledOnce();
    expect(s.nav).toHaveBeenCalledWith(['/teacher/sittings/new'], { queryParams: { templateId: 't1' } });
  });

  it('declined popup saves nothing and stays', async () => {
    const s = await setup('t1');
    s.confirm.confirm.mockResolvedValue(false);
    const title = (s.f.nativeElement as HTMLElement).querySelector<HTMLInputElement>('input[name="title"]')!;
    title.value = 'Đề A khác';
    title.dispatchEvent(new Event('input'));
    s.btn().click();
    await s.f.whenStable();
    expect(s.api.update).not.toHaveBeenCalled();
    expect(s.nav).not.toHaveBeenCalled();
  });
});
