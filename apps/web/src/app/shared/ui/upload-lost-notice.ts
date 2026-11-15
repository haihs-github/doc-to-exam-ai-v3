// Created by Haihs on 15/11/2026
// <app-upload-lost-notice>: amber notice on the "submitted" screen when the essay file is missing from the system or was not fully uploaded. Port of UploadLostNotice.jsx.
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Icon } from './icon';

@Component({
  selector: 'app-upload-lost-notice',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      role="alert"
      class="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-left text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
    >
      <app-icon
        name="alert-circle"
        class="mt-0.5 flex-none"
        svgClass="h-4 w-4 text-amber-600 dark:text-amber-300"
      />
      <span>
        <strong>Chú ý:</strong>
        @if (incomplete()) {
          tệp bài tự luận của bạn chưa tải lên xong (hoặc tải lỗi) lúc nộp bài nên bài tự luận có
          thể thiếu tệp. Hãy báo ngay cho giáo viên hoặc giám thị để được hỗ trợ.
        } @else {
          tệp bài tự luận bạn đã tải lên không còn trên hệ thống nên có thể chưa được ghi nhận kèm
          bài nộp. Hãy báo ngay cho giáo viên hoặc giám thị để được kiểm tra và hỗ trợ.
        }
      </span>
    </div>
  `,
})
export class UploadLostNotice {
  readonly incomplete = input(false);
}
