// Created by Haihs on 12/11/2026
// Specs for <app-select>: combobox/listbox ARIA, keyboard, typeahead, outside click, disabled options.
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Select, SelectOption, nextActiveIndex, typeaheadIndex } from './select';

const OPTS: SelectOption[] = [
  { value: '2024', label: '2024-2025' },
  { value: 'b', label: 'Bravo', disabled: true },
  { value: 'c', label: 'Cam' },
  { value: 'ca', label: 'Cà phê' },
  { value: 'd', label: 'Dưa' },
];

@Component({
  imports: [Select],
  template: `<app-select [options]="opts" [(value)]="v" label="Năm học" /><button id="out">
      o
    </button>`,
})
class Host {
  opts = OPTS;
  v = signal('');
}

const setup = async () => {
  const f = TestBed.createComponent(Host);
  document.body.appendChild(f.nativeElement);
  await f.whenStable();
  const el = f.nativeElement as HTMLElement;
  const cb = el.querySelector<HTMLButtonElement>('[role="combobox"]')!;
  const key = async (k: string) => {
    cb.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
    await f.whenStable();
  };
  const opts = () => [...el.querySelectorAll<HTMLElement>('[role="option"]')];
  const active = () => cb.getAttribute('aria-activedescendant');
  return { f, el, cb, key, opts, active };
};

describe('select helpers', () => {
  it('nextActiveIndex skips disabled and wraps', () => {
    const dis = (i: number) => OPTS[i].disabled;
    expect(nextActiveIndex('ArrowDown', 0, 5, dis)).toBe(2);
    expect(nextActiveIndex('ArrowUp', 0, 5, dis)).toBe(4);
    expect(nextActiveIndex('Home', 3, 5, dis)).toBe(0);
    expect(nextActiveIndex('End', 0, 5, dis)).toBe(4);
    expect(nextActiveIndex('ArrowDown', -1, 0)).toBe(-1);
  });
  it('typeaheadIndex: 1 char cycles from after `from`, many chars match prefix, skips disabled', () => {
    expect(typeaheadIndex(OPTS, 'c', 0)).toBe(2);
    expect(typeaheadIndex(OPTS, 'c', 2)).toBe(3);
    expect(typeaheadIndex(OPTS, 'ca', 2)).toBe(2);
    expect(typeaheadIndex(OPTS, 'cà', 0)).toBe(3);
    expect(typeaheadIndex(OPTS, 'b', 0)).toBe(-1);
  });
});

describe('Select', () => {
  afterEach(() => document.body.replaceChildren());

  it('is a combobox button with label, placeholder "Chọn", collapsed', async () => {
    const { cb, el } = await setup();
    expect(cb.getAttribute('aria-haspopup')).toBe('listbox');
    expect(cb.getAttribute('aria-expanded')).toBe('false');
    const name = cb
      .getAttribute('aria-labelledby')!
      .split(' ')
      .map((id) => el.querySelector('#' + id)!.textContent!.trim())
      .join(' ');
    expect(name).toBe('Năm học Chọn');
    expect(cb.textContent).toContain('Chọn');
    expect(el.querySelector('[role="listbox"]')).toBeNull();
  });

  it('opens on click: listbox, options with aria-selected/aria-disabled, active descendant on first enabled', async () => {
    const { f, cb, el, opts, active } = await setup();
    f.componentInstance.v.set('c');
    await f.whenStable();
    cb.click();
    await f.whenStable();
    expect(cb.getAttribute('aria-expanded')).toBe('true');
    expect(cb.getAttribute('aria-controls')).toBe(el.querySelector('[role="listbox"]')!.id);
    expect(opts()[2].getAttribute('aria-selected')).toBe('true');
    expect(opts()[1].getAttribute('aria-disabled')).toBe('true');
    expect(active()).toBe(opts()[2].id);
  });

  it('scrolls the active option into view while open', async () => {
    const spy = vi.fn();
    (Element.prototype as unknown as { scrollIntoView: unknown }).scrollIntoView = spy;
    try {
      const { f, key } = await setup();
      await key('ArrowDown');
      await key('ArrowDown');
      await f.whenStable();
      expect(spy).toHaveBeenCalledWith({ block: 'nearest' });
    } finally {
      delete (Element.prototype as unknown as { scrollIntoView?: unknown }).scrollIntoView;
    }
  });

  it('arrow keys move the active option (skipping disabled); Enter picks, closes, updates the model', async () => {
    const { f, cb, el, opts, active, key } = await setup();
    await key('ArrowDown');
    expect(active()).toBe(opts()[0].id);
    await key('ArrowDown');
    expect(active()).toBe(opts()[2].id);
    await key('End');
    expect(active()).toBe(opts()[4].id);
    await key('Enter');
    expect(f.componentInstance.v()).toBe('d');
    expect(el.querySelector('[role="listbox"]')).toBeNull();
    expect(cb.textContent).toContain('Dưa');
  });

  it('Escape closes without changing the value and keeps focus on the combobox', async () => {
    const { f, cb, el, key } = await setup();
    cb.focus();
    await key('ArrowDown');
    await key('ArrowDown');
    await key('Escape');
    expect(el.querySelector('[role="listbox"]')).toBeNull();
    expect(f.componentInstance.v()).toBe('');
    expect(document.activeElement).toBe(cb);
  });

  it('typeahead selects when closed', async () => {
    const { f, key } = await setup();
    await key('c');
    expect(f.componentInstance.v()).toBe('c');
  });

  it('typeahead moves the active option when open', async () => {
    const { active, opts, key } = await setup();
    await key('ArrowDown');
    await key('d');
    expect(active()).toBe(opts()[4].id);
  });

  it('clicking an option picks it; disabled option does nothing; outside pointerdown closes', async () => {
    const { f, cb, el, opts } = await setup();
    cb.click();
    await f.whenStable();
    opts()[1].click();
    expect(f.componentInstance.v()).toBe('');
    el.querySelector('#out')!.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    await f.whenStable();
    expect(el.querySelector('[role="listbox"]')).toBeNull();
    cb.click();
    await f.whenStable();
    opts()[2].click();
    await f.whenStable();
    expect(f.componentInstance.v()).toBe('c');
  });
});
