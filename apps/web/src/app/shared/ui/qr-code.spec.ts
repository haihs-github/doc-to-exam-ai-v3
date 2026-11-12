// Created by Haihs on 12/11/2026
// Specs for <app-qr-code>: SVG from the qrcode lib, role=img + aria-label, re-renders when value changes.
import { TestBed } from '@angular/core/testing';
import { QrCode } from './qr-code';

const make = async (value: string) => {
  const f = TestBed.createComponent(QrCode);
  f.componentRef.setInput('value', value);
  await f.whenStable();
  return f;
};
const svg = (f: { nativeElement: unknown }) =>
  (f.nativeElement as HTMLElement).querySelector('svg')!;

describe('QrCode', () => {
  it('renders an svg with role=img, default aria-label and size', async () => {
    const f = await make('https://example.test/join/abc');
    const s = svg(f);
    expect(s.getAttribute('role')).toBe('img');
    expect(s.getAttribute('aria-label')).toBe('Mã QR');
    expect(s.getAttribute('width')).toBe('128');
    expect(s.querySelector('path')!.getAttribute('d')!.length).toBeGreaterThan(20);
  });

  it('honours size and label inputs', async () => {
    const f = await make('x');
    f.componentRef.setInput('size', 64);
    f.componentRef.setInput('label', 'Link học sinh');
    await f.whenStable();
    expect(svg(f).getAttribute('width')).toBe('64');
    expect(svg(f).getAttribute('aria-label')).toBe('Link học sinh');
  });

  it('renders an accessible fallback instead of throwing for oversize input', async () => {
    const f = await make('x'.repeat(4000));
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelector('svg')).toBeNull();
    expect(el.querySelector('[role="img"]')!.textContent).toContain('Không tạo được mã QR');
  });

  it('re-renders when the value changes; empty value renders nothing', async () => {
    const f = await make('aaa');
    const d1 = svg(f).querySelector('path')!.getAttribute('d');
    f.componentRef.setInput('value', 'https://another.example/with/a/longer/path?x=1');
    await f.whenStable();
    expect(svg(f).querySelector('path')!.getAttribute('d')).not.toBe(d1);
    f.componentRef.setInput('value', '');
    await f.whenStable();
    expect((f.nativeElement as HTMLElement).querySelector('svg')).toBeNull();
  });
});
