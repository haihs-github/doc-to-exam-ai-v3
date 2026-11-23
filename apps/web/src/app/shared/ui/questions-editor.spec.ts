// Created by Haihs on 23/11/2026
// Specs cho <app-questions-editor>: nút Lưu cố định, Lên đầu trang và nhãn Gạch chân.
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { EditorQuestion, createMcqQuestion } from '../utils/exam-questions';
import { QuestionsEditor } from './questions-editor';

@Component({
  imports: [QuestionsEditor],
  template: `<form (submit)="submitted = true; $event.preventDefault()">
    <app-questions-editor [(questions)]="qs" [saveLabel]="label()" />
  </form>`,
})
class Host {
  qs = signal<EditorQuestion[]>([createMcqQuestion(1)]);
  label = signal('Lưu đề mẫu');
  submitted = false;
}

const setup = async () => {
  const f = TestBed.createComponent(Host);
  await f.whenStable();
  return f;
};
const btns = (f: { nativeElement: HTMLElement }, text: string) =>
  [...f.nativeElement.querySelectorAll('button')].filter((b) => b.textContent?.trim() === text);

describe('QuestionsEditor save + scroll-top', () => {
  it('shows the save button under the answer panel and submits the parent form', async () => {
    const f = await setup();
    const [web] = btns(f, 'Lưu đề mẫu');
    expect(web.closest('aside')).not.toBeNull();
    web.click();
    expect(f.componentInstance.submitted).toBe(true);
  });

  it('has no save button without saveLabel', async () => {
    const f = await setup();
    f.componentInstance.label.set('');
    await f.whenStable();
    expect(btns(f, 'Lưu đề mẫu').length).toBe(0);
  });

  it('shows "Lên đầu trang" only after scrolling past 300px and scrolls to top', async () => {
    const f = await setup();
    const top = () => f.nativeElement.querySelector('[aria-label="Lên đầu trang"]') as HTMLElement;
    expect(top()).toBeNull();
    Object.defineProperty(window, 'scrollY', { value: 400, configurable: true });
    window.dispatchEvent(new Event('scroll'));
    await f.whenStable();
    const spy = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    // Haihs: jsdom không có matchMedia; kiểm cả prefers-reduced-motion - start
    const mm = (reduce: boolean) =>
      Object.defineProperty(window, 'matchMedia', {
        value: () => ({ matches: reduce }),
        configurable: true,
      });
    mm(false);
    top().click();
    expect(spy).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
    mm(true);
    top().click();
    expect(spy).toHaveBeenLastCalledWith({ top: 0, behavior: 'auto' });
    // Haihs: jsdom không có matchMedia; kiểm cả prefers-reduced-motion - end
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
  });

  it('labels the underline button "Gạch chân" instead of U', async () => {
    const f = await setup();
    const b = f.nativeElement.querySelector('[title^="Gạch chân phần"]') as HTMLElement;
    expect(b.textContent?.trim()).toBe('Gạch chân');
    expect(b.getAttribute('aria-label')).toContain('Gạch chân');
  });
});
