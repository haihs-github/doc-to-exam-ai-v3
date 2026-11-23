// Created by Haihs on 15/11/2026
// <app-search-select>: searchable combobox over an in-memory option list (keyboard navigation, disabled/selected marks). Port of SearchSelect.jsx.
// shortcut: filters a list the page already loaded in full; server paging + infinite scroll of the original is not ported, add it if class/template lists outgrow one fetch.
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

export interface SearchOption {
  key: string;
  label: string;
  /** Muted text after the label (e.g. the class code). */
  hint?: string;
}

/** Case-insensitive match on label + hint. */
export const filterOptions = (options: SearchOption[], query: string): SearchOption[] => {
  const q = query.trim().toLowerCase();
  return q
    ? options.filter((o) => `${o.label} ${o.hint ?? ''}`.toLowerCase().includes(q))
    : options;
};

/** Next active index after a key, skipping disabled rows; -1 when nothing is selectable. */
export const nextActiveIndex = (
  key: string,
  current: number,
  count: number,
  isDisabled: (i: number) => boolean = () => false,
): number => {
  if (!count) return -1;
  const step = (from: number, dir: 1 | -1): number => {
    for (let n = 1; n <= count; n += 1) {
      const i = (from + dir * n + count * (n + 1)) % count;
      if (!isDisabled(i)) return i;
    }
    return -1;
  };
  if (key === 'ArrowDown') return step(current, 1);
  if (key === 'ArrowUp') return step(current < 0 ? 0 : current, -1);
  if (key === 'Home') return isDisabled(0) ? step(0, 1) : 0;
  if (key === 'End') return isDisabled(count - 1) ? step(count - 1, -1) : count - 1;
  return current;
};

let uid = 0;

@Component({
  selector: 'app-search-select',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'relative block' },
  // Haihs: SearchSelect có chế độ tìm phía server, ô thêm giáo viên dùng nó như bản gốc - start
  // đóng code cũ
  //   template: `
  //     <input
  //       type="text"
  //       role="combobox"
  //       autocomplete="off"
  //       [attr.aria-label]="label() || placeholder()"
  //       [attr.aria-expanded]="open()"
  //       [attr.aria-controls]="open() ? listId : null"
  //       aria-autocomplete="list"
  //       [attr.aria-activedescendant]="open() && active() >= 0 ? listId + '-opt-' + active() : null"
  //       [value]="query()"
  //       [placeholder]="placeholder()"
  //       (input)="onInput($event)"
  //       (focus)="open.set(true)"
  //       (keydown)="onKey($event)"
  //       class="min-h-[48px] w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-700 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:focus:ring-sky-400"
  //     />
  //     @if (open()) {
  //       <ul
  //         [id]="listId"
  //         role="listbox"
  //         class="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-overlay dark:border-gray-700 dark:bg-gray-800 dark:shadow-overlay-dark"
  //       >
  //         @for (o of shown(); track o.key; let i = $index) {
  //           <li
  //             [id]="listId + '-opt-' + i"
  //             role="option"
  //             [attr.aria-selected]="isSelected(o)"
  //             [attr.aria-disabled]="isDisabled(o) || null"
  //             (mousedown)="$event.preventDefault()"
  //             tabindex="-1"
  //             (click)="pick(o)"
  //             (keydown.enter)="pick(o)"
  //             (mouseenter)="!isDisabled(o) && active.set(i)"
  //             class="min-h-[44px] px-3 py-2.5 text-base"
  //             [class]="
  //               (isDisabled(o) ? 'cursor-not-allowed opacity-50 ' : 'cursor-pointer ') +
  //               (i === active() ? 'bg-primary-50 dark:bg-gray-700' : '')
  //             "
  //           >
  //             <span class="flex items-center justify-between gap-2">
  //               <span
  //                 class="line-clamp-2 break-words"
  //                 [class]="isSelected(o) ? 'font-semibold text-primary-900 dark:text-sky-400' : ''"
  //                 [attr.title]="o.label"
  //                 >{{ o.label }}
  //                 @if (o.hint) {
  //                   <span class="text-sm text-gray-500 dark:text-gray-400">· {{ o.hint }}</span>
  //                 }
  //               </span>
  //               @if (isSelected(o) && multiple()) {
  //                 <span class="text-sm text-gray-500 dark:text-gray-400">Đã chọn</span>
  //               }
  //             </span>
  //           </li>
  //         }
  //         @if (shown().length === 0) {
  //           <li role="presentation" class="px-3 py-2 text-sm text-gray-600 dark:text-gray-400">
  //             {{ emptyText() }}
  //           </li>
  //         }
  //       </ul>
  //     }
  //   `,
  template: `
    <!-- Haihs: ô hiện tên mục đã chọn (selectedLabel) khi chưa gõ - start -->
    <!-- đóng code cũ -->
    <!-- [value]="query()" -->
    <!-- (focus)="open.set(true)" -->
    <input
      type="text"
      role="combobox"
      autocomplete="off"
      [attr.aria-label]="label() || placeholder()"
      [attr.aria-expanded]="open()"
      [attr.aria-controls]="open() ? listId : null"
      aria-autocomplete="list"
      [attr.aria-activedescendant]="open() && active() >= 0 ? listId + '-opt-' + active() : null"
      [value]="touched() ? query() : selectedLabel()"
      [placeholder]="placeholder()"
      (input)="onInput($event)"
      (focus)="open.set(true); $any($event.target).select()"
      (keydown)="onKey($event)"
      class="min-h-[48px] w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-700 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:focus:ring-sky-400"
    />
    <!-- Haihs: ô hiện tên mục đã chọn (selectedLabel) khi chưa gõ - end -->
    @if (open()) {
      <ul
        [id]="listId"
        role="listbox"
        class="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-overlay dark:border-gray-700 dark:bg-gray-800 dark:shadow-overlay-dark"
      >
        @for (o of shown(); track o.key; let i = $index) {
          <li
            [id]="listId + '-opt-' + i"
            role="option"
            [attr.aria-selected]="isSelected(o)"
            [attr.aria-disabled]="isDisabled(o) || null"
            (mousedown)="$event.preventDefault()"
            tabindex="-1"
            (click)="pick(o)"
            (keydown.enter)="pick(o)"
            (mouseenter)="!isDisabled(o) && active.set(i)"
            class="min-h-[44px] px-3 py-2.5 text-base"
            [class]="
              (isDisabled(o) ? 'cursor-not-allowed opacity-50 ' : 'cursor-pointer ') +
              (i === active() ? 'bg-primary-50 dark:bg-gray-700' : '')
            "
          >
            <span class="flex items-center justify-between gap-2">
              <span
                class="line-clamp-2 break-words"
                [class]="isSelected(o) ? 'font-semibold text-primary-900 dark:text-sky-400' : ''"
                [attr.title]="o.label"
                >{{ o.label }}
                @if (o.hint) {
                  <span class="text-sm text-gray-500 dark:text-gray-400">· {{ o.hint }}</span>
                }
              </span>
              @if (isSelected(o) && multiple()) {
                <span class="text-sm text-gray-500 dark:text-gray-400">Đã chọn</span>
              }
            </span>
          </li>
        }
        @if (loading()) {
          <li role="presentation" class="px-3 py-2 text-sm text-gray-600 dark:text-gray-400">
            Đang tải...
          </li>
        }
        @if (error()) {
          <li role="presentation" class="px-3 py-2 text-sm text-red-700 dark:text-red-400">
            {{ error() }}
          </li>
        }
        @if (!loading() && !error() && shown().length === 0) {
          <li role="presentation" class="px-3 py-2 text-sm text-gray-600 dark:text-gray-400">
            {{ tooShort() ? 'Nhập ít nhất ' + minChars() + ' ký tự' : emptyText() }}
          </li>
        }
      </ul>
    }
  `,
  // Haihs: SearchSelect có chế độ tìm phía server, ô thêm giáo viên dùng nó như bản gốc - end
})
export class SearchSelect {
  readonly options = input.required<SearchOption[]>();
  readonly selectedKeys = input<string[]>([]);
  readonly disabledKeys = input<string[]>([]);
  readonly placeholder = input('Tìm kiếm...');
  readonly label = input('');
  readonly emptyText = input('Không có kết quả');
  /** Marks the selected rows with "Đã chọn" (multi-pick pages keep their own list of picked items). */
  readonly multiple = input(false);
  // Haihs: SearchSelect có chế độ tìm phía server, ô thêm giáo viên dùng nó như bản gốc - start
  /** Options come from the page (server search): no local filtering, every keystroke is reported. */
  readonly remote = input(false);
  readonly minChars = input(0);
  readonly loading = input(false);
  readonly error = input('');
  /** Tên mục đã chọn, hiện trong ô khi người dùng chưa gõ gì. */
  readonly selectedLabel = input(''); // Haihs: tên mục đã chọn hiện trong ô - start - end
  // Haihs: SearchSelect có chế độ tìm phía server, ô thêm giáo viên dùng nó như bản gốc - end
  readonly picked = output<string>();
  // Haihs: SearchSelect có chế độ tìm phía server, ô thêm giáo viên dùng nó như bản gốc - start
  readonly queryChange = output<string>();
  // Haihs: SearchSelect có chế độ tìm phía server, ô thêm giáo viên dùng nó như bản gốc - end

  protected readonly listId = `app-search-select-${++uid}`;
  protected readonly query = signal('');
  protected readonly touched = signal(false); // Haihs: đã gõ thì ô hiện chữ đang gõ thay vì tên mục đã chọn - start - end
  protected readonly open = signal(false);
  protected readonly active = signal(-1);
  // Haihs: SearchSelect có chế độ tìm phía server, ô thêm giáo viên dùng nó như bản gốc - start
  // đóng code cũ
  // protected readonly shown = computed(() => filterOptions(this.options(), this.query()));
  protected readonly shown = computed(() =>
    this.remote() ? this.options() : filterOptions(this.options(), this.query()),
  );
  protected readonly tooShort = computed(
    () => this.remote() && this.query().trim().length < this.minChars(),
  );
  // Haihs: SearchSelect có chế độ tìm phía server, ô thêm giáo viên dùng nó như bản gốc - end
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    const onDown = (e: MouseEvent): void => {
      if (!this.host.nativeElement.contains(e.target as Node)) this.open.set(false);
    };
    document.addEventListener('mousedown', onDown);
    inject(DestroyRef).onDestroy(() => document.removeEventListener('mousedown', onDown));
  }

  protected isSelected = (o: SearchOption): boolean => this.selectedKeys().includes(o.key);
  protected isDisabled = (o: SearchOption): boolean => this.disabledKeys().includes(o.key);

  protected onInput(e: Event): void {
    this.query.set((e.target as HTMLInputElement).value);
    this.touched.set(true); // Haihs: đã gõ - start - end
    // Haihs: SearchSelect có chế độ tìm phía server, ô thêm giáo viên dùng nó như bản gốc - start
    this.queryChange.emit(this.query());
    // Haihs: SearchSelect có chế độ tìm phía server, ô thêm giáo viên dùng nó như bản gốc - end
    this.active.set(-1);
    this.open.set(true);
  }
  protected pick(o: SearchOption): void {
    if (this.isDisabled(o)) return;
    this.picked.emit(o.key);
    this.open.set(false);
    this.query.set('');
    this.touched.set(false); // Haihs: chọn xong thì ô quay về hiện tên mục đã chọn - start - end
    // Haihs: SearchSelect có chế độ tìm phía server, ô thêm giáo viên dùng nó như bản gốc - start
    if (this.remote()) this.queryChange.emit('');
    // Haihs: SearchSelect có chế độ tìm phía server, ô thêm giáo viên dùng nó như bản gốc - end
  }
  protected onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') return void this.open.set(false);
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
      e.preventDefault();
      if (!this.open()) return void this.open.set(true);
      const list = this.shown();
      this.active.set(
        nextActiveIndex(e.key, this.active(), list.length, (i) => this.isDisabled(list[i])),
      );
    } else if (e.key === 'Enter' && this.open()) {
      e.preventDefault();
      const o = this.shown()[this.active()];
      if (o) this.pick(o);
    }
  }
}
