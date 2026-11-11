// Created by Haihs on 12/11/2026
// <app-qr-code>: inline SVG QR from the `qrcode` lib (port of qrcode.react QRCodeSVG usage in ClassInviteTab).
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { create } from 'qrcode';

const QUIET = 4; // quiet-zone modules

@Component({
  selector: 'app-qr-code',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (qr(); as q) {
      <svg
        role="img"
        [attr.aria-label]="label()"
        [attr.width]="size()"
        [attr.height]="size()"
        [attr.viewBox]="'0 0 ' + (q.n + 2 * quiet) + ' ' + (q.n + 2 * quiet)"
        shape-rendering="crispEdges"
      >
        <rect width="100%" height="100%" fill="#fff" />
        <path [attr.d]="q.d" fill="#000" />
      </svg>
    }
  `,
  host: { class: 'inline-block' },
})
export class QrCode {
  readonly value = input.required<string>();
  readonly size = input(128);
  readonly label = input('Mã QR');
  protected readonly quiet = QUIET;
  protected readonly qr = computed(() => {
    const v = this.value();
    if (!v) return null;
    const { size: n, data } = create(v, { errorCorrectionLevel: 'M' }).modules;
    let d = '';
    for (let i = 0; i < data.length; i += 1) {
      if (data[i]) d += `M${(i % n) + QUIET} ${Math.floor(i / n) + QUIET}h1v1h-1z`;
    }
    return { n, d };
  });
}
