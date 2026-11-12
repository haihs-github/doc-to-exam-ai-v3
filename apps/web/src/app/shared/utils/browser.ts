// Created by Haihs on 12/11/2026
// Browser helpers: file download, safe file names, clipboard copy with fallback; port of client/src/utils/browser.js.

/** Blob download (a data: URI would be truncated at '#'). */
export function downloadTextFile(
  name: string,
  text: string,
  mime = 'text/csv;charset=utf-8;',
): void {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000); // let the browser start the download first
}

export function safeFileName(s: string): string {
  return (
    String(s || 'file')
      .replace(/[\\/:*?"<>|]/g, '')
      .replace(/\s+/g, '_')
      .slice(0, 120) || 'file'
  );
}

/** navigator.clipboard needs a secure context (not http://192.168.x.x), so fall back to execCommand. Never throws. */
export async function copyToClipboard(text: string): Promise<boolean> {
  const value = String(text ?? '');
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // fall through to the textarea fallback
    }
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = value;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:-9999px;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
