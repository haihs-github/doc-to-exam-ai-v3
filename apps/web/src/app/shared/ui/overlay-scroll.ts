// Created by Haihs on 23/11/2026
// installOverlayScroll: thanh cuộn mảnh phủ lên nội dung (1 cặp thanh dùng chung), cuộn gốc vẫn do trình duyệt xử lý.
const OVERFLOW = /auto|scroll|overlay/;

export function installOverlayScroll(doc: Document = document): () => void {
  const win = doc.defaultView!;
  const reduced = win.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const mk = (cls: string) => {
    const d = doc.createElement('div');
    d.className = `osb ${cls}`;
    d.setAttribute('aria-hidden', 'true');
    if (reduced) d.style.transition = 'none';
    doc.body.append(d);
    return d;
  };
  const tv = mk('osb-v');
  const th = mk('osb-h');
  const root = () => (doc.scrollingElement ?? doc.documentElement) as HTMLElement;
  let cur: HTMLElement | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let dragging = false;

  const canY = (e: HTMLElement) => e.scrollHeight > e.clientHeight + 1;
  const canX = (e: HTMLElement) => e.scrollWidth > e.clientWidth + 1;
  const scrollable = (e: HTMLElement) => {
    if (e === root()) return canY(e) || canX(e);
    const s = win.getComputedStyle(e);
    return (OVERFLOW.test(s.overflowY) && canY(e)) || (OVERFLOW.test(s.overflowX) && canX(e));
  };
  // Phần tử cuộn được gần nhất; không có thì cuộn của trang.
  const pick = (t: EventTarget | null): HTMLElement | null => {
    let e = t instanceof HTMLElement ? t : null;
    while (e && e !== doc.body && e !== doc.documentElement) {
      if (scrollable(e)) return e;
      e = e.parentElement;
    }
    return scrollable(root()) ? root() : null;
  };
  const hide = () => {
    if (dragging) return;
    tv.classList.remove('on');
    th.classList.remove('on');
  };
  const place = () => {
    if (!cur || !cur.isConnected) return hide();
    const isRoot = cur === root();
    const r = isRoot
      ? { left: 0, top: 0 }
      : cur.getBoundingClientRect();
    const ch = isRoot ? doc.documentElement.clientHeight : cur.clientHeight;
    const cw = isRoot ? doc.documentElement.clientWidth : cur.clientWidth;
    const { scrollHeight: sh, scrollWidth: sw, scrollTop: st, scrollLeft: sl } = cur;
    const v = sh > ch + 1;
    const h = sw > cw + 1;
    const x0 = r.left + (isRoot ? 0 : cur.clientLeft);
    const y0 = r.top + (isRoot ? 0 : cur.clientTop);
    if (v) {
      const trk = ch - (h ? 10 : 0);
      const len = Math.max(28, (trk * ch) / sh);
      tv.style.height = `${len}px`;
      tv.style.left = `${x0 + cw - 9}px`;
      tv.style.top = `${y0 + 2 + (st / (sh - ch)) * (trk - len - 4)}px`;
    }
    if (h) {
      const trk = cw - (v ? 10 : 0);
      const len = Math.max(28, (trk * cw) / sw);
      th.style.width = `${len}px`;
      th.style.top = `${y0 + ch - 9}px`;
      th.style.left = `${x0 + 2 + (sl / (sw - cw)) * (trk - len - 4)}px`;
    }
    tv.classList.toggle('on', v);
    th.classList.toggle('on', h);
  };
  const show = (e: HTMLElement) => {
    if (dragging) return;
    cur = e;
    place();
    clearTimeout(timer);
    timer = setTimeout(hide, 1000);
  };
  // Gom các sự kiện cuộn trong 1 khung hình: đọc/ghi layout 1 lần mỗi frame.
  let raf = 0;
  let pending: EventTarget | null = null;
  const onScroll = (e: Event) => {
    pending = e.target;
    if (raf) return;
    raf = win.requestAnimationFrame(() => {
      raf = 0;
      if (dragging) return place();
      const t = pending === doc ? root() : pick(pending);
      if (t) show(t);
    });
  };
  const onOver = (e: MouseEvent) => {
    if (e.target === tv || e.target === th) return clearTimeout(timer);
    const t = pick(e.target);
    if (t) show(t);
  };
  const onOut = (e: MouseEvent) => {
    if (e.relatedTarget === tv || e.relatedTarget === th || dragging) return;
    clearTimeout(timer);
    timer = setTimeout(hide, 600);
  };

  // Kéo thanh bằng chuột/chạm: chỉ đặt scrollTop/scrollLeft, cuộn vẫn là của trình duyệt.
  const cleanups: (() => void)[] = [];
  for (const [el, y] of [[tv, true], [th, false]] as const) {
    const down = (e: PointerEvent) => {
      if (!cur) return;
      e.preventDefault();
      el.setPointerCapture?.(e.pointerId);
      dragging = true;
      el.classList.add('drag');
      const target = cur;
      const p0 = y ? e.clientY : e.clientX;
      const s0 = y ? target.scrollTop : target.scrollLeft;
      const move = (m: PointerEvent) => {
        const isRoot = target === root();
        const ch = y
          ? isRoot ? doc.documentElement.clientHeight : target.clientHeight
          : isRoot ? doc.documentElement.clientWidth : target.clientWidth;
        const sh = y ? target.scrollHeight : target.scrollWidth;
        const len = el.getBoundingClientRect()[y ? 'height' : 'width'];
        const v = s0 + (((y ? m.clientY : m.clientX) - p0) * (sh - ch)) / Math.max(1, ch - len);
        if (y) target.scrollTop = v;
        else target.scrollLeft = v;
      };
      const up = () => {
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerup', up);
        el.removeEventListener('pointercancel', up);
        dragging = false;
        el.classList.remove('drag');
        timer = setTimeout(hide, 800);
      };
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
    };
    el.addEventListener('pointerdown', down);
    cleanups.push(() => el.removeEventListener('pointerdown', down));
  }

  doc.addEventListener('scroll', onScroll, true);
  doc.addEventListener('mouseover', onOver);
  doc.addEventListener('mouseout', onOut);
  win.addEventListener('resize', hide);
  return () => {
    doc.removeEventListener('scroll', onScroll, true);
    doc.removeEventListener('mouseover', onOver);
    doc.removeEventListener('mouseout', onOut);
    win.removeEventListener('resize', hide);
    cleanups.forEach((c) => c());
    clearTimeout(timer);
    win.cancelAnimationFrame(raf);
    tv.remove();
    th.remove();
  };
}
