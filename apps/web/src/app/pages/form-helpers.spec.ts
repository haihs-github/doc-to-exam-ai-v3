// Created by Haihs on 11/11/2026
// Specs for page form helpers: server field errors, focusing a field by name, the safe `from` state.
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { fieldFailure, focusField, navigationFrom } from './form-helpers';

describe('fieldFailure', () => {
  const order = ['phoneNumber', 'password'] as const;
  it('VALIDATION with a known field -> {field, message}', () => {
    expect(
      fieldFailure(
        { success: false, code: 'VALIDATION', field: 'password', message: 'Ngắn quá', status: 400 },
        order,
      ),
    ).toEqual({
      field: 'password',
      message: 'Ngắn quá',
    });
  });
  it.each([
    [{ success: false, code: 'VALIDATION', message: 'x', status: 400 }],
    [{ success: false, code: 'VALIDATION', field: 'other', message: 'x', status: 400 }],
    [{ success: false, code: 'PHONE_TAKEN', field: 'phoneNumber', message: 'x', status: 409 }],
    [new Error('boom')],
    [null],
  ])('%j -> null', (e) => expect(fieldFailure(e, order)).toBeNull());
  it('falls back to the generic message when the server message is empty', () => {
    expect(
      fieldFailure(
        { success: false, code: 'VALIDATION', field: 'password', message: '', status: 400 },
        order,
      )?.message,
    ).toBe('Có lỗi xảy ra. Vui lòng thử lại!');
  });
});

describe('focusField', () => {
  it('focuses the control with that name inside root', () => {
    const root = document.createElement('div');
    root.innerHTML = '<input name="a"><div name="b"></div><div><input name="b"></div>';
    document.body.append(root);
    focusField(root, 'b');
    expect(document.activeElement).toBe(root.querySelector('input[name="b"]'));
    expect(() => focusField(root, 'zzz')).not.toThrow();
    root.remove();
  });
});

describe('navigationFrom', () => {
  const setup = async (state?: unknown) => {
    TestBed.configureTestingModule({ providers: [provideRouter([{ path: '**', children: [] }])] });
    const router = TestBed.inject(Router);
    const p = router.navigateByUrl('/x', { state: state as Record<string, unknown> });
    const from = navigationFrom(router);
    await p;
    return from;
  };
  it('reads a string path from the navigation state', async () => {
    expect(await setup({ from: '/teacher/templates' })).toBe('/teacher/templates');
  });
  it.each([['https://evil.example'], ['//evil.example'], [42], [undefined]])(
    'ignores %j',
    async (f) => {
      expect(await setup({ from: f })).toBeUndefined();
    },
  );
});
