// Created by Haihs on 12/11/2026
// Specs for browser helpers: safeFileName, copyToClipboard fallbacks (never throws), downloadTextFile (Blob + anchor).
import { copyToClipboard, downloadTextFile, safeFileName } from './browser';

describe('safeFileName', () => {
  it('bỏ ký tự cấm, khoảng trắng -> _, cắt 120, mặc định "file"', () => {
    expect(safeFileName('a/b:c*d?"e<f>g|h\\i')).toBe('abcdefghi');
    expect(safeFileName('Lớp 10 A1')).toBe('Lớp_10_A1');
    expect(safeFileName('x'.repeat(200))).toHaveLength(120);
    expect(safeFileName('')).toBe('file');
    expect(safeFileName(null as never)).toBe('file');
    expect(safeFileName('///')).toBe('file');
  });
});

// The test DOM may not define these properties, so spyOn-getter fails; define and restore by hand.
const saved: [object, string, PropertyDescriptor | undefined][] = [];
const define = (obj: object, key: string, value: unknown) => {
  saved.push([obj, key, Object.getOwnPropertyDescriptor(obj, key)]);
  Object.defineProperty(obj, key, { value, configurable: true });
};

describe('copyToClipboard', () => {
  afterEach(() => {
    for (const [obj, key, d] of saved.splice(0).reverse()) {
      if (d) Object.defineProperty(obj, key, d);
      else delete (obj as Record<string, unknown>)[key];
    }
    vi.restoreAllMocks();
  });

  it('dùng navigator.clipboard khi có (secure context)', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    define(navigator, 'clipboard', { writeText });
    define(window, 'isSecureContext', true);
    expect(await copyToClipboard('abc')).toBe(true);
    expect(writeText).toHaveBeenCalledWith('abc');
  });

  it('clipboard từ chối -> rơi xuống execCommand, trả kết quả thật', async () => {
    define(navigator, 'clipboard', {
      writeText: vi.fn().mockRejectedValue(new Error('x')),
    });
    define(window, 'isSecureContext', true);
    document.execCommand = vi.fn().mockReturnValue(true);
    expect(await copyToClipboard('abc')).toBe(true);
    expect(document.execCommand).toHaveBeenCalledWith('copy');
    expect(document.querySelector('textarea')).toBeNull();
    (document.execCommand as ReturnType<typeof vi.fn>).mockReturnValue(false);
    expect(await copyToClipboard('abc')).toBe(false);
  });

  it('mọi cách đều lỗi -> false, không ném', async () => {
    define(window, 'isSecureContext', false);
    document.execCommand = vi.fn().mockImplementation(() => {
      throw new Error('nope');
    });
    await expect(copyToClipboard('abc')).resolves.toBe(false);
  });
});

describe('downloadTextFile', () => {
  it('tạo Blob đúng mime, click thẻ a với tên file, dọn DOM và revoke URL sau đó', () => {
    vi.useFakeTimers();
    const create = vi.fn().mockReturnValue('blob:x');
    const revoke = vi.fn();
    URL.createObjectURL = create;
    URL.revokeObjectURL = revoke;
    let clicked: { name: string; attached: boolean } | null = null;
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicked = { name: this.download, attached: document.body.contains(this) };
    });
    downloadTextFile('a.csv', 'hello', 'text/csv');
    const blob = create.mock.calls[0][0] as Blob;
    expect(blob.type).toBe('text/csv');
    expect(clicked).toEqual({ name: 'a.csv', attached: true });
    expect(document.querySelector('a[download]')).toBeNull();
    expect(revoke).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(revoke).toHaveBeenCalledWith('blob:x');
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
});
