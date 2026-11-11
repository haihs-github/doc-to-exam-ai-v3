// Created by Haihs on 12/11/2026
// Specs for <app-action-menu>: menu button ARIA, keyboard nav, Esc focus return, outside-click close, item actions.
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ActionMenu, ActionMenuItem } from './action-menu';

const calls: string[] = [];
@Component({
  imports: [ActionMenu],
  template: `<app-action-menu [items]="items" /><button id="outside">out</button>`,
})
class Host {
  items: ActionMenuItem[] = [
    { label: 'Sửa', onClick: () => calls.push('edit') },
    { label: 'Tắt', onClick: () => calls.push('off'), disabled: true },
    { label: 'Mở', to: '/classes/1' },
    { label: 'Xóa', onClick: () => calls.push('del'), danger: true },
  ];
}

const setup = async () => {
  calls.length = 0;
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const f = TestBed.createComponent(Host);
  document.body.appendChild(f.nativeElement);
  await f.whenStable();
  const el = f.nativeElement as HTMLElement;
  const trigger = el.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]')!;
  const items = () => [...el.querySelectorAll<HTMLElement>('[role="menuitem"]')];
  const key = async (k: string) => {
    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
    await f.whenStable();
  };
  const open = async () => {
    trigger.click();
    await f.whenStable();
  };
  return { f, el, trigger, items, key, open };
};

describe('ActionMenu', () => {
  afterEach(() => document.body.replaceChildren());

  it('trigger has aria-label/haspopup/expanded and opens a role=menu', async () => {
    const { el, trigger, items, open } = await setup();
    expect(trigger.getAttribute('aria-label')).toBe('Thao tác');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(el.querySelector('[role="menu"]')).toBeNull();
    await open();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(items().map((i) => i.textContent!.trim())).toEqual(['Sửa', 'Tắt', 'Mở', 'Xóa']);
  });

  it('focuses the first item on open; arrows skip disabled and wrap; Home/End jump', async () => {
    const { items, key, open } = await setup();
    await open();
    expect(document.activeElement).toBe(items()[0]);
    await key('ArrowDown');
    expect(document.activeElement).toBe(items()[2]);
    await key('End');
    expect(document.activeElement).toBe(items()[3]);
    await key('ArrowDown');
    expect(document.activeElement).toBe(items()[0]);
    await key('ArrowUp');
    expect(document.activeElement).toBe(items()[3]);
    await key('Home');
    expect(document.activeElement).toBe(items()[0]);
  });

  it('Escape closes and returns focus to the trigger', async () => {
    const { el, trigger, key, open } = await setup();
    await open();
    await key('Escape');
    expect(el.querySelector('[role="menu"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('closes on outside pointerdown but not inside', async () => {
    const { f, el, items, open } = await setup();
    await open();
    items()[0].dispatchEvent(new Event('pointerdown', { bubbles: true }));
    await f.whenStable();
    expect(el.querySelector('[role="menu"]')).not.toBeNull();
    el.querySelector('#outside')!.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    await f.whenStable();
    expect(el.querySelector('[role="menu"]')).toBeNull();
  });

  it('activating an item closes the menu and runs onClick; disabled item does not', async () => {
    const { el, items, open, f } = await setup();
    await open();
    (items()[1] as HTMLButtonElement).click();
    expect(calls).toEqual([]);
    (items()[3] as HTMLButtonElement).click();
    await f.whenStable();
    expect(calls).toEqual(['del']);
    expect(el.querySelector('[role="menu"]')).toBeNull();
  });

  it('returns focus to the trigger after activating an item', async () => {
    const { trigger, items, open, f } = await setup();
    await open();
    (items()[0] as HTMLButtonElement).click();
    await f.whenStable();
    expect(document.activeElement).toBe(trigger);
  });

  it('renders `to` items as links', async () => {
    const { items, open } = await setup();
    await open();
    expect(items()[2].tagName).toBe('A');
    expect(items()[2].getAttribute('href')).toBe('/classes/1');
  });
});
