// Created by Haihs on 11/11/2026
// Public About page (/about); port of client/src/pages/About.jsx. Mounted inside the shell's <main>.
// shortcut: no GitHub star-count fetch and no decorative mock-up panels (they carried real-looking student names); add if marketing wants them.
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiHealth } from './api-health';

const REPO_URL = 'https://github.com/haihs-github/doc-to-exam-v2';
const COMMANDS = `git clone ${REPO_URL}.git
cd doc-to-exam-v2 && npm run install-all
cp server/.env.example server/.env
npm run generate-secrets
npm run dev`;

const STEPS = [
  {
    title: 'Tạo tài khoản giáo viên',
    text: 'Đăng ký bằng số điện thoại, rồi dán Gemini API Key của bạn vào tài khoản.',
  },
  {
    title: 'Tải đề thi lên',
    text: 'Gemini đọc file PDF hoặc Word, tách câu hỏi và đáp án. Bạn xem lại và sửa trước khi lưu thành đề mẫu.',
  },
  {
    title: 'Tạo ca thi từ đề mẫu',
    text: 'Đặt giờ mở, giờ đóng, thời lượng, bật đảo đề và kiểm tra gian lận.',
  },
  {
    title: 'Tạo lớp học để gán ca thi',
    text: 'Mời học sinh vào lớp bằng link, hoặc nhập danh sách. Chọn lớp và học sinh được vào ca.',
  },
  {
    title: 'Gửi link hoặc QR cho học sinh',
    text: 'Học sinh đăng nhập, quét mã hoặc nhập mã ca là vào làm bài ngay trên điện thoại.',
  },
];

const WRAP = 'mx-auto w-full max-w-[1680px] px-[clamp(1rem,3.5vw,4rem)]';
const EYEBROW = 'text-sm font-semibold uppercase tracking-wider text-primary-700 dark:text-sky-400';
const H2 =
  'mt-2 text-balance text-[clamp(1.6rem,4vw,2.25rem)] font-semibold leading-tight text-gray-900 dark:text-gray-100';
const MUTED = 'text-gray-600 dark:text-gray-300';
const PILL =
  'inline-flex min-h-[48px] items-center gap-2 rounded-full border border-gray-200 bg-primary-50 px-4 text-base font-semibold text-gray-900 hover:border-primary-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:hover:border-sky-400';

@Component({
  selector: 'app-about',
  imports: [RouterLink, ApiHealth],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="text-gray-700 dark:text-gray-200">
      <section class="py-14 sm:py-16">
        <div [class]="wrap" class="min-w-0">
          <div [class]="eyebrow">Tạo bài thi trực tuyến bằng Gemini</div>
          <h1
            class="mt-3 max-w-[22ch] text-balance text-[clamp(2rem,5.2vw,3.25rem)] font-semibold leading-[1.12] text-gray-900 dark:text-gray-100"
          >
            Biến <span class="text-primary-700 dark:text-sky-400">Gemini</span> của bạn thành công
            cụ tạo bài thi trực tuyến
          </h1>
          <p class="mt-4 max-w-[62ch] text-lg" [class]="muted">
            Tải file đề PDF hoặc Word lên, Gemini nhận diện câu hỏi và đáp án. Bạn rà soát, tạo ca
            thi, gửi link hoặc mã QR cho học sinh. Hệ thống tự chấm trắc nghiệm, hỗ trợ chấm tự luận
            và theo dõi kết quả từng lớp.
          </p>
          <div class="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <a routerLink="/teacher/register" class="btn btn-primary">Dùng thử ngay</a>
            <a [href]="repo" target="_blank" rel="noopener noreferrer" [class]="pill"
              >Star trên GitHub</a
            >
          </div>
          <p class="mt-4 text-base text-gray-500 dark:text-gray-400">
            Miễn phí. Bạn chỉ cần một tài khoản Gemini.
          </p>
        </div>
      </section>

      <section
        class="border-y border-gray-200 bg-primary-50 py-14 dark:border-gray-700 dark:bg-gray-800/50 sm:py-16"
        aria-labelledby="about-steps"
      >
        <div [class]="wrap">
          <div [class]="eyebrow">Thao tác nhanh chóng dễ dàng làm quen</div>
          <h2 id="about-steps" [class]="h2">Tạo bài thi trực tuyến nhanh chóng chỉ với 5 bước</h2>
          <ol
            class="mt-10 grid max-w-xl list-none gap-6 p-0 min-[1100px]:max-w-none min-[1100px]:grid-cols-5"
          >
            @for (s of steps; track s.title; let i = $index) {
              <li
                class="grid min-w-0 content-start gap-2.5 rounded-lg border border-gray-200 bg-white p-[18px] dark:border-gray-700 dark:bg-gray-900"
              >
                <span
                  class="inline-flex h-8 w-8 items-center justify-center rounded bg-primary-700 text-base font-semibold text-white dark:bg-sky-400 dark:text-gray-900"
                  aria-hidden="true"
                  >{{ i + 1 }}</span
                >
                <h3 class="text-[17px] font-semibold leading-snug text-gray-900 dark:text-gray-100">
                  {{ s.title }}
                </h3>
                <p class="text-[15px] leading-relaxed" [class]="muted">{{ s.text }}</p>
              </li>
            }
          </ol>
        </div>
      </section>

      <section class="py-14 sm:py-16">
        <div [class]="wrap" class="grid gap-16 min-[900px]:grid-cols-2 min-[900px]:gap-12">
          <div class="min-w-0">
            <div [class]="eyebrow">Thi nghiêm túc</div>
            <h2 [class]="h2">Tích hợp đảo câu và chống gian lận</h2>
            <p class="mt-3 max-w-[54ch]" [class]="muted">
              Mỗi học sinh nhận một thứ tự câu hỏi và đáp án riêng, nên nhìn bài nhau không có ích.
              Chống gian lận được tích hợp sẵn, bạn bật cho từng ca thi khi cần.
            </p>
            <ul class="mt-4 grid gap-2.5">
              @for (t of cheatTicks; track t) {
                <li class="flex items-start gap-2.5">
                  <span class="font-bold text-primary-700 dark:text-sky-400" aria-hidden="true"
                    >✓</span
                  >
                  <span>{{ t }}</span>
                </li>
              }
            </ul>
          </div>
          <div class="min-w-0">
            <div [class]="eyebrow">Chấm bài và kết quả</div>
            <h2 [class]="h2">Tiết kiệm thời gian chấm bài cho giáo viên</h2>
            <p class="mt-3 max-w-[54ch]" [class]="muted">
              Kết quả trắc nghiệm có ngay sau khi học sinh làm bài. Câu tự luận được chấm theo từng
              tiêu chí rõ ràng, nên bạn không phải chấm lại từ đầu và dễ giải thích điểm với học
              sinh.
            </p>
            <ul class="mt-4 grid gap-2.5">
              @for (t of gradeTicks; track t) {
                <li class="flex items-start gap-2.5">
                  <span class="font-bold text-primary-700 dark:text-sky-400" aria-hidden="true"
                    >✓</span
                  >
                  <span>{{ t }}</span>
                </li>
              }
            </ul>
          </div>
        </div>
      </section>

      <section class="bg-primary-700 py-14 text-white dark:bg-sky-400 dark:text-gray-900">
        <div [class]="wrap" class="grid items-center gap-8 min-[900px]:grid-cols-[1.2fr_1fr]">
          <div class="min-w-0">
            <h2 class="text-balance text-[clamp(1.6rem,4vw,2.25rem)] font-semibold leading-tight">
              Hoàn toàn miễn phí, chỉ cần có tài khoản Gemini
            </h2>
            <p class="mt-3 max-w-[56ch]">
              Không gói trả phí, không giới hạn số đề. Khóa Gemini là của bạn, lưu mã hóa trong tài
              khoản và chỉ dùng để đọc đề bạn tải lên.
            </p>
          </div>
          <ul
            class="grid gap-2.5 rounded-lg border border-white/30 bg-white/10 p-4 dark:border-gray-900/30 dark:bg-gray-900/10"
          >
            @for (t of freeTicks; track t) {
              <li class="flex gap-2.5"><span aria-hidden="true">✓</span>{{ t }}</li>
            }
          </ul>
        </div>
      </section>

      <section class="py-14 sm:py-16" aria-labelledby="about-start">
        <div [class]="wrap">
          <div [class]="eyebrow">Bắt đầu</div>
          <h2 id="about-start" [class]="h2">
            Thử ngay bản web, hoặc tự host đơn giản và nhanh chóng
          </h2>
          <div class="mt-8 grid gap-5 min-[900px]:grid-cols-[1fr_1.2fr]">
            <div class="card grid min-w-0 content-start gap-3 !p-[22px]">
              <h3 class="text-xl font-semibold text-gray-900 dark:text-gray-100">Dùng bản web</h3>
              <p [class]="muted">
                Đăng ký tài khoản giáo viên và tạo ca thi đầu tiên trong vài phút, không cần cài gì.
              </p>
              <a routerLink="/teacher/register" class="btn btn-primary">Đăng ký giáo viên</a>
            </div>
            <div class="card grid min-w-0 content-start gap-3 !p-[22px]">
              <h3 class="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Tự host trên máy chủ của bạn
              </h3>
              <p [class]="muted">
                Cần Node.js và một cơ sở dữ liệu MongoDB. Làm theo hướng dẫn trong README.
              </p>
              <div class="relative rounded-lg bg-gray-950 p-4 text-gray-200">
                <button
                  type="button"
                  (click)="copy()"
                  class="absolute right-2 top-2 inline-flex min-h-[36px] items-center rounded border border-gray-700 bg-gray-800 px-3 text-sm font-semibold text-gray-200 hover:bg-gray-700"
                >
                  {{ copied() ? 'Đã sao chép' : 'Sao chép' }}
                  <span class="sr-only"> các lệnh</span>
                </button>
                <pre
                  class="m-0 overflow-x-auto pt-8 font-mono text-sm leading-7"
                ><code>{{ commands }}</code></pre>
              </div>
              <div>
                <a [href]="repo" target="_blank" rel="noopener noreferrer" [class]="pill"
                  >Xem mã nguồn trên GitHub</a
                >
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        class="border-t border-gray-200 bg-primary-50 py-14 dark:border-gray-700 dark:bg-gray-800/50"
        aria-labelledby="about-cta"
      >
        <div [class]="wrap" class="flex flex-wrap items-center justify-between gap-6">
          <h2
            id="about-cta"
            class="max-w-[22ch] text-balance text-[clamp(1.6rem,4vw,2.4rem)] font-semibold leading-tight text-gray-900 dark:text-gray-100"
          >
            Tạo ca thi đầu tiên của bạn ngay hôm nay
          </h2>
          <div class="flex w-full flex-col gap-3 sm:w-auto">
            <div class="flex flex-col gap-3 sm:flex-row">
              <a routerLink="/teacher/register" class="btn btn-primary">Đăng ký ngay</a>
              <a routerLink="/teacher/login" class="btn btn-secondary"
                >Đã có tài khoản? Đăng nhập</a
              >
            </div>
            <p class="text-base text-gray-500 dark:text-gray-400">
              Bạn là học sinh?
              <a routerLink="/login" class="link-accent font-semibold">Đăng nhập tại đây</a>
            </p>
          </div>
        </div>
      </section>

      <section class="py-10" aria-labelledby="about-health">
        <div [class]="wrap">
          <h2 id="about-health" class="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Trạng thái hệ thống
          </h2>
          <div class="mt-2"><app-api-health /></div>
        </div>
      </section>

      <footer class="border-t border-gray-200 py-8 dark:border-gray-700" [class]="muted">
        <div [class]="wrap" class="grid gap-5">
          <div class="min-w-0">
            <h2 class="text-base font-semibold text-gray-900 dark:text-gray-100">
              Cam kết về Gemini API Key của bạn
            </h2>
            <p class="mt-1 max-w-[80ch] text-[15px] leading-relaxed">
              Khóa Gemini chỉ được lưu giữ để tạo đề thi cho chính bạn. Chúng tôi không thu thập,
              không chia sẻ và không dùng khóa của bạn vào bất kỳ việc nào khác. Bạn có thể xóa khóa
              khỏi tài khoản bất cứ lúc nào.
            </p>
          </div>
          <div
            class="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 pt-5 text-[15px] dark:border-gray-700"
          >
            <span>DocToExam AI</span>
            <span class="flex flex-wrap gap-x-4 gap-y-1">
              <a
                routerLink="/teacher/login"
                class="hover:text-primary-700 hover:underline dark:hover:text-sky-300"
                >Dành cho giáo viên</a
              >
              <a
                [href]="repo"
                target="_blank"
                rel="noopener noreferrer"
                class="hover:text-primary-700 hover:underline dark:hover:text-sky-300"
                >GitHub</a
              >
            </span>
          </div>
        </div>
      </footer>
    </div>
  `,
})
export class About {
  protected readonly wrap = WRAP;
  protected readonly eyebrow = EYEBROW;
  protected readonly h2 = H2;
  protected readonly muted = MUTED;
  protected readonly pill = PILL;
  protected readonly repo = REPO_URL;
  protected readonly commands = COMMANDS;
  protected readonly steps = STEPS;
  protected readonly cheatTicks = [
    'Đảo thứ tự câu và đáp án theo từng học sinh',
    'Chống gian lận tích hợp sẵn, bật hoặc tắt cho từng ca thi',
    'Học sinh làm bài ngay trên điện thoại, không cần cài ứng dụng',
  ];
  protected readonly gradeTicks = [
    'Điểm trắc nghiệm có ngay sau khi nộp bài',
    'Điểm tự luận chấm theo từng tiêu chí rõ ràng',
    'Bảng điểm theo từng lớp, xuất Excel',
  ];
  protected readonly freeTicks = [
    'Không thu phí giáo viên và học sinh',
    'Dùng khóa Gemini của chính bạn',
    'Mã nguồn mở, tự cài trên máy chủ của bạn',
  ];
  protected readonly copied = signal(false);

  protected copy(): void {
    // Clipboard needs a secure context/permission; on failure just leave the label unchanged.
    navigator.clipboard?.writeText(COMMANDS).then(
      () => {
        this.copied.set(true);
        setTimeout(() => this.copied.set(false), 2000);
      },
      () => undefined,
    );
  }
}
