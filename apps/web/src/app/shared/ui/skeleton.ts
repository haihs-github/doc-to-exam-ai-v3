// Created by Haihs on 12/11/2026
// <app-skeleton>: pulsing grey block, or a fake list (role=status) while data loads (port of Skeleton.jsx).
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (variant() === 'list') {
      <div role="status" aria-busy="true" aria-live="polite" class="space-y-3">
        <span class="sr-only">Đang tải...</span>
        @for (r of rows(); track r) {
          <div data-row class="card flex items-center gap-4">
            <div aria-hidden="true" [class]="pulse + ' h-10 w-10 shrink-0'"></div>
            <div class="flex-1 space-y-2">
              <div aria-hidden="true" [class]="pulse + ' h-4 w-2/5'"></div>
              <div aria-hidden="true" [class]="pulse + ' h-3 w-3/5'"></div>
            </div>
            <div aria-hidden="true" [class]="pulse + ' hidden h-7 w-20 sm:block'"></div>
          </div>
        }
      </div>
    } @else {
      <div aria-hidden="true" [class]="pulse + ' ' + class()"></div>
    }
  `,
})
export class Skeleton {
  readonly variant = input<'block' | 'list'>('block');
  /** Rows of the list variant. */
  readonly lines = input(5);
  /** Extra classes (size) for the block variant. */
  readonly class = input('h-4 w-full');
  protected readonly rows = computed(() => Array.from({ length: this.lines() }, (_, i) => i));
  protected readonly pulse = 'animate-pulse rounded bg-gray-200 dark:bg-gray-700';
}
