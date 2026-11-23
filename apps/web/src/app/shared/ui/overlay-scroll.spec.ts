// Created by Haihs on 23/11/2026
// Specs cho installOverlayScroll: dựng/gỡ thanh, hiện khi cuộn vùng cuộn được, không rò listener.
import { installOverlayScroll } from './overlay-scroll';

describe('installOverlayScroll', () => {
  const metrics = (el: HTMLElement) => {
    for (const [k, v] of [['scrollHeight', 1000], ['clientHeight', 100], ['scrollWidth', 100], ['clientWidth', 100]] as const)
      Object.defineProperty(el, k, { configurable: true, value: v });
  };

  it('adds one vertical + one horizontal bar and removes them on dispose', () => {
    const off = installOverlayScroll(document);
    expect(document.querySelectorAll('.osb').length).toBe(2);
    off();
    expect(document.querySelectorAll('.osb').length).toBe(0);
  });

  it('shows the vertical bar when a scrollable element scrolls, and not after dispose', async () => {
    const box = document.createElement('div');
    box.style.overflowY = 'auto';
    metrics(box);
    document.body.append(box);
    const off = installOverlayScroll(document);
    box.dispatchEvent(new Event('scroll'));
    await new Promise((r) => requestAnimationFrame(r));
    expect(document.querySelector('.osb-v')!.classList.contains('on')).toBe(true);
    expect(document.querySelector('.osb-h')!.classList.contains('on')).toBe(false);
    off();
    box.remove();
    expect(document.querySelector('.osb-v')).toBeNull();
  });
});
