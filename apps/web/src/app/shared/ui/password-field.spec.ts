// Created by Haihs on 11/11/2026
// Specs for <app-password-field>: show/hide toggle (type, aria-pressed, Vietnamese labels) and two-way value.
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PasswordField } from './password-field';

@Component({ imports: [PasswordField], template: `<app-password-field [(value)]="pw" />` })
class Host {
  readonly pw = signal('');
}

describe('PasswordField', () => {
  it('toggles input type, aria-pressed and the label', async () => {
    const f = TestBed.createComponent(Host);
    await f.whenStable();
    const el = f.nativeElement as HTMLElement;
    const input = el.querySelector('input')!;
    const btn = el.querySelector('button')!;
    expect(input.type).toBe('password');
    expect(btn.getAttribute('aria-pressed')).toBe('false');
    expect(btn.getAttribute('aria-label')).toBe('Hiện mật khẩu');
    btn.click();
    await f.whenStable();
    expect(input.type).toBe('text');
    expect(btn.getAttribute('aria-pressed')).toBe('true');
    expect(btn.getAttribute('aria-label')).toBe('Ẩn mật khẩu');
    btn.click();
    await f.whenStable();
    expect(input.type).toBe('password');
  });

  it('button is type=button (never submits a form) and typing updates the model', async () => {
    const f = TestBed.createComponent(Host);
    await f.whenStable();
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelector('button')!.type).toBe('button');
    const input = el.querySelector('input')!;
    input.value = 'secret1';
    input.dispatchEvent(new Event('input'));
    expect(f.componentInstance.pw()).toBe('secret1');
  });
});
