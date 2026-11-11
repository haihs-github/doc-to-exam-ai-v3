// Created by Haihs on 11/11/2026
// Specs for <app-form-field>: label/for wiring, aria-describedby, aria-invalid, role=alert error.
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormField } from './form-field';
import { PasswordField } from './password-field';

@Component({
  imports: [FormField],
  template: `
    <app-form-field label="Số điện thoại" [error]="error()" [hint]="hint()" [required]="true">
      <input class="input" />
    </app-form-field>
  `,
})
class Host {
  readonly error = signal('');
  readonly hint = signal('');
}

const setup = async () => {
  const fixture = TestBed.createComponent(Host);
  await fixture.whenStable();
  const root = fixture.nativeElement as HTMLElement;
  // getByLabelText: label text -> its `for` -> element with that id
  const byLabel = (text: string): HTMLElement | null => {
    const l = [...root.querySelectorAll('label')].find((x) => x.textContent?.includes(text));
    return l ? root.querySelector<HTMLElement>(`#${CSS.escape(l.htmlFor)}`) : null;
  };
  return { fixture, root, byLabel };
};

describe('FormField', () => {
  it('label is bound to the projected input via for/id', async () => {
    const { root, byLabel } = await setup();
    const input = byLabel('Số điện thoại');
    expect(input).toBe(root.querySelector('input'));
    expect(input?.getAttribute('aria-required')).toBe('true');
  });

  it('error renders role=alert, sets aria-invalid and aria-describedby', async () => {
    const { fixture, root, byLabel } = await setup();
    fixture.componentInstance.error.set('Bắt buộc');
    await fixture.whenStable();
    const input = byLabel('Số điện thoại')!;
    const alert = root.querySelector('[role="alert"]')!;
    expect(alert.textContent).toContain('Bắt buộc');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')?.split(' ')).toContain(alert.id);
  });

  it('no error: no alert, no aria-invalid; hint is described; clearing the error removes the wiring', async () => {
    const { fixture, root, byLabel } = await setup();
    fixture.componentInstance.hint.set('10 số');
    fixture.componentInstance.error.set('x');
    await fixture.whenStable();
    fixture.componentInstance.error.set('');
    await fixture.whenStable();
    const input = byLabel('Số điện thoại')!;
    expect(root.querySelector('[role="alert"]')).toBeNull();
    expect(input.hasAttribute('aria-invalid')).toBe(false);
    const hintEl = [...root.querySelectorAll('p')].find((p) => p.textContent === '10 số')!;
    expect(input.getAttribute('aria-describedby')).toBe(hintEl.id);
  });
});

@Component({
  imports: [FormField, PasswordField],
  template: `
    <app-form-field label="Mật khẩu" [error]="error()"><app-password-field /></app-form-field>
  `,
})
class PwHost {
  readonly error = signal('');
}

@Component({
  imports: [FormField],
  template: `
    <app-form-field label="Tên" [hint]="'gợi ý'">
      @if (show()) {
        <input id="mine" aria-describedby="extern stale" />
      }
    </app-form-field>
  `,
})
class LateHost {
  readonly show = signal(false);
}

describe('FormField with nested / late / pre-wired controls', () => {
  it('wraps <app-password-field>: label -> for -> the REAL inner input carries aria-invalid/describedby', async () => {
    const f = TestBed.createComponent(PwHost);
    await f.whenStable();
    f.componentInstance.error.set('Sai');
    await f.whenStable();
    const root = f.nativeElement as HTMLElement;
    const label = root.querySelector('label')!;
    const input = root.querySelector<HTMLInputElement>(`#${CSS.escape(label.htmlFor)}`)!;
    expect(input).toBe(root.querySelector('app-password-field input'));
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe(root.querySelector('[role="alert"]')!.id);
    // the toggle button must NOT be mistaken for the control
    expect(root.querySelector('button')!.hasAttribute('aria-invalid')).toBe(false);
  });

  it('control appearing later (inside @if) is wired; authored id is kept and aria-describedby is merged', async () => {
    const f = TestBed.createComponent(LateHost);
    await f.whenStable();
    const root = f.nativeElement as HTMLElement;
    f.componentInstance.show.set(true);
    await f.whenStable();
    const input = root.querySelector('input')!;
    expect(input.id).toBe('mine');
    expect(root.querySelector('label')!.htmlFor).toBe('mine');
    const hint = root.querySelector('p')!;
    const tokens = input.getAttribute('aria-describedby')!.split(' ');
    expect(tokens).toEqual(expect.arrayContaining(['extern', 'stale', hint.id]));
  });
});
