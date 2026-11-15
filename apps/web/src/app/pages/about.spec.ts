// Created by Haihs on 11/11/2026
// Specs for the public About page: sections/headings, links, and the mounted <app-api-health>.
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { ApiClient } from '../core/api-client';
import { About, formatStars } from './about';

describe('About', () => {
  beforeEach(() => vi.stubGlobal('fetch', () => Promise.reject(new Error('offline'))));
  afterEach(() => vi.unstubAllGlobals());

  const setup = async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    TestBed.overrideProvider(ApiClient, { useValue: { get: () => new Subject() } });
    const f = TestBed.createComponent(About);
    await f.whenStable();
    return f.nativeElement as HTMLElement;
  };

  it('has exactly one h1, h2 sections, and no nested <main> (the shell owns it)', async () => {
    const el = await setup();
    expect(el.querySelectorAll('h1')).toHaveLength(1);
    expect(el.querySelector('h1')?.textContent).toContain('Gemini');
    const h2 = [...el.querySelectorAll('h2')].map((h) => h.textContent);
    expect(h2.length).toBeGreaterThanOrEqual(5);
    expect(h2.some((t) => t?.includes('5 bước'))).toBe(true);
    expect(el.querySelector('main')).toBeNull();
  });

  it('lists the five steps in an ordered list', async () => {
    const el = await setup();
    expect(el.querySelectorAll('ol > li')).toHaveLength(5);
  });

  it('mounts <app-api-health> inside a "Trạng thái hệ thống" section', async () => {
    const el = await setup();
    const sec = el.querySelector('section[aria-labelledby="about-health"]');
    expect(sec?.querySelector('#about-health')?.textContent).toContain('Trạng thái hệ thống');
    expect(sec?.querySelector('app-api-health')).not.toBeNull();
  });

  it('every link has text; external ones are noopener; CTAs go to the auth routes', async () => {
    const el = await setup();
    for (const a of el.querySelectorAll('a')) expect(a.textContent?.trim()).not.toBe('');
    for (const a of el.querySelectorAll('a[target="_blank"]'))
      expect(a.getAttribute('rel')).toContain('noopener');
    const hrefs = [...el.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(
      expect.arrayContaining(['/teacher/register', '/teacher/login', '/login']),
    );
  });

  it('has a footer landmark with the Gemini key commitment', async () => {
    const el = await setup();
    expect(el.querySelector('footer')?.textContent).toContain('Cam kết về Gemini API Key');
  });

  it('self-host block: clone + npm install / npm run dev, GitHub links go to the repo', async () => {
    const el = await setup();
    const t = el.textContent ?? '';
    for (const bad of ['install-all', 'generate-secrets', 'server/.env'])
      expect(t).not.toContain(bad);
    const code = el.querySelector('pre')?.textContent ?? '';
    expect(code).toContain('git clone https://github.com/haihs-github/doc-to-exam-v2.git');
    expect(code).toContain('npm install');
    expect(code).toContain('npm run dev');
    expect(t).toContain('MONGODB_URI');
    expect(t).toContain('Node.js 22');
    const gh = [...el.querySelectorAll('a[target="_blank"]')].map((a) => a.getAttribute('href'));
    expect(gh.length).toBeGreaterThanOrEqual(3);
    expect(new Set(gh)).toEqual(new Set(['https://github.com/haihs-github/doc-to-exam-v2']));
  });

  it('renders step icons, step arrows and the mock-up panels', async () => {
    const el = await setup();
    expect(el.querySelectorAll('ol > li app-icon')).toHaveLength(5 + 4 * 2);
    expect(
      el.querySelector('[aria-label="Xem trước giao diện làm bài và bảng điểm"]'),
    ).not.toBeNull();
    expect(el.querySelector('table[aria-label="Ví dụ bảng điểm"]')).not.toBeNull();
    expect(el.textContent).toContain('Cùng một câu hỏi, hai học sinh');
  });

  it('formatStars shortens like the original', () => {
    expect([0, 999, 1000, 1234, 146_700, -1, NaN].map(formatStars)).toEqual([
      '0',
      '999',
      '1k',
      '1.2k',
      '146.7k',
      '',
      '',
    ]);
  });

  it('flags features still in development', async () => {
    const el = await setup();
    expect(el.textContent).toContain('Một số tính năng đang trong quá trình phát triển.');
  });
});
