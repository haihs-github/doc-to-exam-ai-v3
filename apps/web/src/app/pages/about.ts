// Created by Haihs on 11/11/2026
// Public About page (/about); port of client/src/pages/About.jsx. Mounted inside the shell's <main>.
// Haihs: khôi phục ảnh minh hoạ, icon, mũi tên, nút GitHub như bản gốc - start
// đóng code cũ
// // shortcut: no GitHub star-count fetch and no decorative mock-up panels (they carried real-looking student names), add them if marketing wants them.
// // TODO(web): điền URL repo (nút GitHub, lệnh clone) khi repo công khai
// Hero/feature mock-up panels, step icons+arrows, GitHub pill with live star count restored to match the original.
import { NgTemplateOutlet } from '@angular/common';
// Haihs: khôi phục ảnh minh hoạ, icon, mũi tên, nút GitHub như bản gốc - end
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon, type IconName } from '../shared/ui/icon';
import { ApiHealth } from './api-health';

// Haihs: khôi phục ảnh minh hoạ, icon, mũi tên, nút GitHub như bản gốc - start
// đóng code cũ
// const COMMANDS = `npm install
const REPO_URL = 'https://github.com/haihs-github/doc-to-exam-v2';
const STARS_API = 'https://api.github.com/repos/haihs-github/doc-to-exam-v2';
const COMMANDS = `git clone ${REPO_URL}.git
cd doc-to-exam-v2 && npm install
// Haihs: khôi phục ảnh minh hoạ, icon, mũi tên, nút GitHub như bản gốc - end
npm run dev`;

// Haihs: khôi phục ảnh minh hoạ, icon, mũi tên, nút GitHub như bản gốc - start
// đóng code cũ
// const STEPS = [
/** 0-999 as is; from 1000 one decimal ("1.2k", "146.7k", no ".0"); non finite / negative → ''. */
export const formatStars = (n: number): string => {
  if (!Number.isFinite(n) || n < 0) return '';
  if (n < 1000) return String(Math.floor(n));
  const k = Math.floor(n / 100) / 10;
  return `${Number.isInteger(k) ? k : k.toFixed(1)}k`;
};

const STEPS: { icon: IconName; title: string; text: string }[] = [
  // Haihs: khôi phục ảnh minh hoạ, icon, mũi tên, nút GitHub như bản gốc - end
  {
    // Haihs: khôi phục ảnh minh hoạ, icon, mũi tên, nút GitHub như bản gốc - start
    icon: 'user',
    // Haihs: khôi phục ảnh minh hoạ, icon, mũi tên, nút GitHub như bản gốc - end
    title: 'Tạo tài khoản giáo viên',
    text: 'Đăng ký bằng số điện thoại, rồi dán Gemini API Key của bạn vào tài khoản.',
  },
  {
    // Haihs: khôi phục ảnh minh hoạ, icon, mũi tên, nút GitHub như bản gốc - start
    icon: 'upload',
    // Haihs: khôi phục ảnh minh hoạ, icon, mũi tên, nút GitHub như bản gốc - end
    title: 'Tải đề thi lên',
    text: 'Gemini đọc file PDF hoặc Word, tách câu hỏi và đáp án. Bạn xem lại và sửa trước khi lưu thành đề mẫu.',
  },
  {
    // Haihs: khôi phục ảnh minh hoạ, icon, mũi tên, nút GitHub như bản gốc - start
    icon: 'calendar',
    // Haihs: khôi phục ảnh minh hoạ, icon, mũi tên, nút GitHub như bản gốc - end
    title: 'Tạo ca thi từ đề mẫu',
    text: 'Đặt giờ mở, giờ đóng, thời lượng, bật đảo đề và kiểm tra gian lận.',
  },
  {
    // Haihs: khôi phục ảnh minh hoạ, icon, mũi tên, nút GitHub như bản gốc - start
    icon: 'cap',
    // Haihs: khôi phục ảnh minh hoạ, icon, mũi tên, nút GitHub như bản gốc - end
    title: 'Tạo lớp học để gán ca thi',
    text: 'Mời học sinh vào lớp bằng link, hoặc nhập danh sách. Chọn lớp và học sinh được vào ca.',
  },
  {
    // Haihs: khôi phục ảnh minh hoạ, icon, mũi tên, nút GitHub như bản gốc - start
    icon: 'qr',
    // Haihs: khôi phục ảnh minh hoạ, icon, mũi tên, nút GitHub như bản gốc - end
    title: 'Gửi link hoặc QR cho học sinh',
    text: 'Học sinh đăng nhập, quét mã hoặc nhập mã ca là vào làm bài ngay trên điện thoại.',
  },
];

const WRAP = 'mx-auto w-full max-w-[1680px] px-[clamp(1rem,3.5vw,4rem)]';
const EYEBROW = 'text-sm font-semibold uppercase tracking-wider text-primary-700 dark:text-sky-400';
const H2 =
  'mt-2 text-balance text-[clamp(1.6rem,4vw,2.25rem)] font-semibold leading-tight text-gray-900 dark:text-gray-100';
const MUTED = 'text-gray-600 dark:text-gray-300';
// Haihs: khôi phục ảnh minh hoạ, icon, mũi tên, nút GitHub như bản gốc - start
const PEEK =
  'grid min-w-0 gap-3 rounded-lg border border-gray-200 bg-primary-50/60 p-3.5 dark:border-gray-700 dark:bg-gray-800/60';
const CAP = 'text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400';
const OPT =
  'flex min-h-[44px] items-center gap-2.5 rounded-lg border border-gray-200 px-3 dark:border-gray-700';
const OPT_ON =
  'border-primary-700 bg-primary-100 text-primary-900 dark:border-sky-400 dark:bg-sky-900/30 dark:text-sky-200';
const MONO = 'font-mono tabular-nums';
const B_OK =
  'badge border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/40 dark:text-green-300';
const B_WARN =
  'badge border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-900/40 dark:text-amber-300';
const B_BAD =
  'badge border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/40 dark:text-red-300';
const B_BRAND = 'badge bg-primary-100 text-primary-900 dark:bg-sky-900/30 dark:text-sky-300';
const B_GRAY =
  'badge border-gray-200 bg-gray-100 text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300';
const PILL =
  'inline-flex min-h-[48px] items-center gap-2 rounded-full border border-gray-200 bg-primary-50 px-4 text-base font-semibold text-gray-900 hover:border-primary-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:hover:border-sky-400';
const ICON_OK = 'mt-1 h-5 w-5 flex-none text-primary-700 dark:text-sky-400';

// Haihs: khôi phục ảnh minh hoạ, icon, mũi tên, nút GitHub như bản gốc - end
@Component({
  selector: 'app-about',
  // Haihs: khôi phục ảnh minh hoạ, icon, mũi tên, nút GitHub như bản gốc - start
  // đóng code cũ
  // imports: [RouterLink, ApiHealth],
  imports: [RouterLink, NgTemplateOutlet, ApiHealth, Icon],
  // Haihs: khôi phục ảnh minh hoạ, icon, mũi tên, nút GitHub như bản gốc - end
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="text-gray-700 dark:text-gray-200">
      <section class="py-14 sm:py-16">
        <!-- Haihs: khôi phục ảnh minh hoạ, icon, mũi tên, nút GitHub như bản gốc - start -->
        <!-- đóng code cũ -->
        <!-- <div [class]="wrap" class="min-w-0"> -->
        <!-- <div [class]="eyebrow">Tạo bài thi trực tuyến bằng Gemini</div> -->
        <!-- <h1 -->
        <!-- class="mt-3 max-w-[22ch] text-balance text-[clamp(2rem,5.2vw,3.25rem)] font-semibold leading-[1.12] text-gray-900 dark:text-gray-100" -->
        <!-- > -->
        <!-- Biến <span class="text-primary-700 dark:text-sky-400">Gemini</span> của bạn thành công -->
        <!-- cụ tạo bài thi trực tuyến -->
        <!-- </h1> -->
        <!-- <p class="mt-4 max-w-[62ch] text-lg" [class]="muted"> -->
        <!-- Tải file đề PDF hoặc Word lên, Gemini nhận diện câu hỏi và đáp án. Bạn rà soát, tạo ca -->
        <!-- thi, gửi link hoặc mã QR cho học sinh. Hệ thống tự chấm trắc nghiệm, hỗ trợ chấm tự luận -->
        <!-- và theo dõi kết quả từng lớp. -->
        <!-- </p> -->
        <!-- <div class="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center"> -->
        <!-- <a routerLink="/teacher/register" class="btn btn-primary">Dùng thử ngay</a> -->
        <div
          [class]="wrap"
          class="grid items-center gap-10 min-[900px]:grid-cols-[1.05fr_1fr] min-[900px]:gap-12"
        >
          <div class="min-w-0">
            <div [class]="eyebrow">Tạo bài thi trực tuyến bằng Gemini</div>
            <h1
              class="mt-3 text-balance text-[clamp(2rem,5.2vw,3.25rem)] font-semibold leading-[1.12] text-gray-900 dark:text-gray-100"
            >
              Biến <span class="text-primary-700 dark:text-sky-400">Gemini</span> của bạn thành công
              cụ tạo bài thi trực tuyến
            </h1>
            <p class="mt-4 max-w-[62ch] text-lg" [class]="muted">
              Tải file đề PDF hoặc Word lên, Gemini nhận diện câu hỏi và đáp án. Bạn rà soát, tạo ca
              thi, gửi link hoặc mã QR cho học sinh. Hệ thống tự chấm trắc nghiệm, hỗ trợ chấm tự
              luận và theo dõi kết quả từng lớp.
            </p>
            <div class="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <a routerLink="/teacher/register" class="btn btn-primary">Dùng thử ngay</a>
              <ng-container *ngTemplateOutlet="pill; context: { label: 'Star trên GitHub' }" />
            </div>
            <p class="mt-4 text-base text-gray-500 dark:text-gray-400">
              Miễn phí. Bạn chỉ cần một tài khoản Gemini.
            </p>
            <!-- Haihs: khôi phục ảnh minh hoạ, icon, mũi tên, nút GitHub như bản gốc - end -->
          </div>
          <!-- Haihs: khôi phục ảnh minh hoạ, icon, mũi tên, nút GitHub như bản gốc - start -->
          <!-- đóng code cũ -->
          <!-- <p class="mt-4 text-base text-gray-500 dark:text-gray-400"> -->
          <!-- Miễn phí. Bạn chỉ cần một tài khoản Gemini. -->
          <!-- </p> -->

          <div [class]="peek" aria-label="Xem trước giao diện làm bài và bảng điểm">
            <div class="card min-w-0">
              <div class="flex justify-between gap-2 text-sm text-gray-500 dark:text-gray-400">
                <span>Ca: Kiểm tra điều kiện số 02 · Câu 7 / 31</span>
                <span class="font-semibold text-gray-900 dark:text-gray-100" [class]="mono"
                  >38:12</span
                >
              </div>
              <p class="mt-2.5 font-medium">She ___ to school by bike every day.</p>
              <div class="mt-3 grid gap-2">
                @for (o of heroOpts; track o[0]) {
                  <div [class]="opt" [class]="o[0] === 'B' ? optOn : ''">
                    <span class="w-5 font-semibold text-gray-500 dark:text-gray-400">{{
                      o[0]
                    }}</span
                    >{{ o[1] }}
                  </div>
                }
              </div>
            </div>
            <div class="card min-w-0">
              <div [class]="cap">Bảng điểm</div>
              <div class="mt-2.5 flex flex-wrap items-center gap-2">
                <span class="font-semibold text-gray-900 dark:text-gray-100">Bùi Thanh Nhung</span>
                <span [class]="bBad">Gian lận</span>
                <span [class]="bBrand">11A</span>
                <span [class]="bOk + ' ' + mono">6.50</span>
                <span [class]="bWarn + ' ' + mono">1.25</span>
                <span [class]="bBrand + ' ' + mono">7.75</span>
              </div>
            </div>
          </div>
          <!-- Haihs: khôi phục ảnh minh hoạ, icon, mũi tên, nút GitHub như bản gốc - end -->
        </div>
      </section>

      <section
        class="border-y border-gray-200 bg-primary-50 py-14 dark:border-gray-700 dark:bg-gray-800/50 sm:py-16"
        aria-labelledby="about-steps"
      >
        <div [class]="wrap">
          <div [class]="eyebrow">Thao tác nhanh chóng dễ dàng làm quen</div>
          <h2 id="about-steps" [class]="h2">Tạo bài thi trực tuyến nhanh chóng chỉ với 5 bước</h2>
          <!-- Haihs: khôi phục ảnh minh hoạ, icon, mũi tên, nút GitHub như bản gốc - start -->
          <!-- đóng code cũ -->
          <!-- class="mt-10 grid max-w-xl list-none gap-6 p-0 min-[1100px]:max-w-none min-[1100px]:grid-cols-5" -->
          <ol
            class="mt-10 grid max-w-xl list-none gap-10 p-0 min-[1100px]:max-w-none min-[1100px]:grid-cols-5 min-[1100px]:gap-9"
          >
            <!-- Haihs: khôi phục ảnh minh hoạ, icon, mũi tên, nút GitHub như bản gốc - end -->
            <!-- Haihs: khôi phục ảnh minh hoạ, icon, mũi tên, nút GitHub như bản gốc - start -->
            <!-- đóng code cũ -->
            <!-- @for (s of steps; track s.title; let i = $index) { -->
            @for (s of steps; track s.title; let i = $index; let last = $last) {
              <!-- Haihs: khôi phục ảnh minh hoạ, icon, mũi tên, nút GitHub như bản gốc - end -->
              <!-- Haihs: khôi phục ảnh minh hoạ, icon, mũi tên, nút GitHub như bản gốc - start -->
              <!-- đóng code cũ -->
              <!-- class="grid min-w-0 content-start gap-2.5 rounded-lg border border-gray-200 bg-white p-[18px] dark:border-gray-700 dark:bg-gray-900" -->
              <li
                class="relative grid min-w-0 content-start gap-2.5 rounded-lg border border-gray-200 bg-white p-[18px] dark:border-gray-700 dark:bg-gray-900"
              >
                <!-- Haihs: khôi phục ảnh minh hoạ, icon, mũi tên, nút GitHub như bản gốc - end -->
                <!-- Haihs: khôi phục ảnh minh hoạ, icon, mũi tên, nút GitHub như bản gốc - start -->
                <!-- đóng code cũ -->
                <!-- <span -->
                <!-- class="inline-flex h-8 w-8 items-center justify-center rounded bg-primary-700 text-base font-semibold text-white dark:bg-sky-400 dark:text-gray-900" -->
                <!-- aria-hidden="true" -->
                <!-- >{{ i + 1 }}</span -->
                <!-- > -->
                <div class="flex items-center justify-between">
                  <span
                    class="inline-flex h-8 w-8 items-center justify-center rounded bg-primary-700 text-base font-semibold text-white dark:bg-sky-400 dark:text-gray-900"
                    aria-hidden="true"
                    >{{ i + 1 }}</span
                  >
                  <app-icon
                    [name]="s.icon"
                    svgClass="h-[22px] w-[22px] text-primary-700 dark:text-sky-400"
                  />
                </div>
                <!-- Haihs: khôi phục ảnh minh hoạ, icon, mũi tên, nút GitHub như bản gốc - end -->
                <h3 class="text-[17px] font-semibold leading-snug text-gray-900 dark:text-gray-100">
                  {{ s.title }}
                </h3>
                <p class="text-[15px] leading-relaxed" [class]="muted">{{ s.text }}</p>
                <!-- Haihs: khôi phục ảnh minh hoạ, icon, mũi tên, nút GitHub như bản gốc - start -->
                @if (!last) {
                  <app-icon
                    name="right"
                    class="absolute -right-[29px] top-1/2 hidden -translate-y-1/2 min-[1100px]:block"
                    svgClass="h-[22px] w-[22px] text-primary-700 dark:text-sky-400"
                  />
                  <app-icon
                    name="down"
                    class="absolute -bottom-[32px] left-1/2 -translate-x-1/2 min-[1100px]:hidden"
                    svgClass="h-[22px] w-[22px] text-primary-700 dark:text-sky-400"
                  />
                }
                <!-- Haihs: khôi phục ảnh minh hoạ, icon, mũi tên, nút GitHub như bản gốc - end -->
              </li>
            }
          </ol>
        </div>
      </section>

      <section class="py-14 sm:py-16">
        <!-- Haihs: khôi phục ảnh minh hoạ, icon, mũi tên, nút GitHub như bản gốc - start -->
        <!-- đóng code cũ -->
        <!-- <div [class]="wrap" class="grid gap-16 min-[900px]:grid-cols-2 min-[900px]:gap-12"> -->
        <!-- <div class="min-w-0"> -->
        <!-- <div [class]="eyebrow">Thi nghiêm túc</div> -->
        <!-- <h2 [class]="h2">Tích hợp đảo câu và chống gian lận</h2> -->
        <!-- <p class="mt-3 max-w-[54ch]" [class]="muted"> -->
        <!-- Mỗi học sinh nhận một thứ tự câu hỏi và đáp án riêng, nên nhìn bài nhau không có ích. -->
        <!-- Chống gian lận được tích hợp sẵn, bạn bật cho từng ca thi khi cần. -->
        <!-- </p> -->
        <!-- <ul class="mt-4 grid gap-2.5"> -->
        <!-- @for (t of cheatTicks; track t) { -->
        <!-- <li class="flex items-start gap-2.5"> -->
        <!-- <span class="font-bold text-primary-700 dark:text-sky-400" aria-hidden="true" -->
        <!-- >✓</span -->
        <!-- > -->
        <!-- <span>{{ t }}</span> -->
        <!-- </li> -->
        <!-- } -->
        <!-- </ul> -->
        <div [class]="wrap" class="grid gap-16">
          <div class="grid items-center gap-10 min-[900px]:grid-cols-2 min-[900px]:gap-12">
            <div class="min-w-0">
              <div [class]="eyebrow">Thi nghiêm túc</div>
              <h2 [class]="h2">Tích hợp đảo câu và chống gian lận</h2>
              <p class="mt-3 max-w-[54ch]" [class]="muted">
                Mỗi học sinh nhận một thứ tự câu hỏi và đáp án riêng, nên nhìn bài nhau không có
                ích. Chống gian lận được tích hợp sẵn, bạn bật cho từng ca thi khi cần.
              </p>
              <ul class="mt-4 grid gap-2.5">
                @for (t of cheatTicks; track t) {
                  <li class="flex items-start gap-2.5">
                    <app-icon name="check" [svgClass]="iconOk" />
                    <span>{{ t }}</span>
                  </li>
                }
              </ul>
            </div>
            <div [class]="peek">
              <div class="card min-w-0">
                <div [class]="cap">Cùng một câu hỏi, hai học sinh</div>
                <div class="mt-3 grid gap-2.5 min-[520px]:grid-cols-2">
                  @for (st of shuffled; track st.who) {
                    <div class="min-w-0">
                      <span [class]="bGray">{{ st.who }}</span>
                      <div class="mt-2 grid gap-2">
                        @for (o of st.opts; track o; let i = $index) {
                          <div [class]="opt + ' min-h-[38px] text-[15px]'">
                            <span class="w-5 font-semibold text-gray-500 dark:text-gray-400">{{
                              'ABCD'[i]
                            }}</span
                            >{{ o }}
                          </div>
                        }
                      </div>
                    </div>
                  }
                </div>
              </div>
              <div class="card min-w-0">
                <div [class]="cap">Cài đặt ca thi</div>
                <div class="mt-3 grid gap-2">
                  @for (t of settings; track t) {
                    <div
                      class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 px-3 py-2.5 text-[15px] dark:border-gray-700"
                    >
                      <span>{{ t }}</span
                      ><span [class]="bOk">Bật</span>
                    </div>
                  }
                </div>
              </div>
            </div>
            <!-- Haihs: khôi phục ảnh minh hoạ, icon, mũi tên, nút GitHub như bản gốc - end -->
          </div>
          <!-- Haihs: khôi phục ảnh minh hoạ, icon, mũi tên, nút GitHub như bản gốc - start -->
          <!-- đóng code cũ -->
          <!-- <div class="min-w-0"> -->
          <!-- <div [class]="eyebrow">Chấm bài và kết quả</div> -->
          <!-- <h2 [class]="h2">Tiết kiệm thời gian chấm bài cho giáo viên</h2> -->
          <!-- <p class="mt-3 max-w-[54ch]" [class]="muted"> -->
          <!-- Kết quả trắc nghiệm có ngay sau khi học sinh làm bài. Câu tự luận được chấm theo từng -->
          <!-- tiêu chí rõ ràng, nên bạn không phải chấm lại từ đầu và dễ giải thích điểm với học -->
          <!-- sinh. -->
          <!-- </p> -->
          <!-- <ul class="mt-4 grid gap-2.5"> -->
          <!-- @for (t of gradeTicks; track t) { -->
          <!-- <li class="flex items-start gap-2.5"> -->
          <!-- <span class="font-bold text-primary-700 dark:text-sky-400" aria-hidden="true" -->
          <!-- >✓</span -->
          <!-- > -->
          <!-- <span>{{ t }}</span> -->
          <!-- </li> -->
          <!-- } -->
          <!-- </ul> -->

          <div class="grid items-center gap-10 min-[900px]:grid-cols-2 min-[900px]:gap-12">
            <div class="min-w-0 min-[900px]:order-2">
              <div [class]="eyebrow">Chấm bài và kết quả</div>
              <h2 [class]="h2">Tiết kiệm thời gian chấm bài cho giáo viên</h2>
              <p class="mt-3 max-w-[54ch]" [class]="muted">
                Kết quả trắc nghiệm có ngay sau khi học sinh làm bài. Câu tự luận được chấm theo
                từng tiêu chí rõ ràng, nên bạn không phải chấm lại từ đầu và dễ giải thích điểm với
                học sinh.
              </p>
              <ul class="mt-4 grid gap-2.5">
                @for (t of gradeTicks; track t) {
                  <li class="flex items-start gap-2.5">
                    <app-icon name="check" [svgClass]="iconOk" />
                    <span>{{ t }}</span>
                  </li>
                }
              </ul>
            </div>
            <div [class]="peek + ' min-[900px]:order-1'">
              <div class="card min-w-0 overflow-x-auto">
                <table class="w-full border-collapse text-[15px]" aria-label="Ví dụ bảng điểm">
                  <thead>
                    <tr
                      class="border-b border-gray-200 text-left text-xs uppercase tracking-wider text-gray-500 dark:border-gray-700 dark:text-gray-400"
                    >
                      <th class="px-2.5 py-2 font-semibold">Học sinh</th>
                      <th class="px-2.5 py-2 font-semibold">Trắc nghiệm</th>
                      <th class="px-2.5 py-2 font-semibold">Tự luận</th>
                      <th class="px-2.5 py-2 font-semibold">Tổng</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr class="border-b border-gray-200 dark:border-gray-700">
                      <td class="px-2.5 py-3">Bùi Thanh Nhung</td>
                      <td class="px-2.5 py-3"><span [class]="bOk + ' ' + mono">6.50</span></td>
                      <td class="px-2.5 py-3"><span [class]="bWarn + ' ' + mono">1.25</span></td>
                      <td class="px-2.5 py-3"><span [class]="bBrand + ' ' + mono">7.75</span></td>
                    </tr>
                    <tr>
                      <td class="px-2.5 py-3">Võ Bảo Nhung</td>
                      <td class="px-2.5 py-3"><span [class]="bOk + ' ' + mono">7.50</span></td>
                      <td class="px-2.5 py-3"><span [class]="bGray">Chưa chấm</span></td>
                      <td class="px-2.5 py-3"><span [class]="bGray">–</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div
                class="card flex min-w-0 flex-wrap items-center justify-between gap-2 text-[15px]"
              >
                <span>1 bài đã sẵn sàng · 1 bài chưa chấm xong</span>
                <span [class]="bBrand">Đã có kết quả</span>
              </div>
            </div>
            <!-- Haihs: khôi phục ảnh minh hoạ, icon, mũi tên, nút GitHub như bản gốc - end -->
          </div>
          <!-- Haihs: khôi phục ảnh minh hoạ, icon, mũi tên, nút GitHub như bản gốc - start -->
          <!-- đóng code cũ -->
          <!-- <p class="text-sm text-gray-500 dark:text-gray-400 min-[900px]:col-span-2"> -->
          <p class="text-sm text-gray-500 dark:text-gray-400">
            <!-- Haihs: khôi phục ảnh minh hoạ, icon, mũi tên, nút GitHub như bản gốc - end -->
            Một số tính năng đang trong quá trình phát triển.
          </p>
        </div>
      </section>

      <section class="bg-primary-700 py-14 text-white dark:bg-sky-400 dark:text-gray-900">
        <div [class]="wrap" class="grid items-center gap-8 min-[900px]:grid-cols-[1.2fr_1fr]">
          <div class="min-w-0">
            <h2 class="text-balance text-[clamp(1.6rem,4vw,2.25rem)] font-semibold leading-tight">
              Hoàn toàn miễn phí, chỉ cần có tài khoản Gemini
            </h2>
            <!-- Haihs: khôi phục ảnh minh hoạ, icon, mũi tên, nút GitHub như bản gốc - start -->
            <!-- đóng code cũ -->
            <!-- <p class="mt-3 max-w-[56ch]"> -->
            <p class="mt-3 max-w-[56ch] opacity-90">
              <!-- Haihs: khôi phục ảnh minh hoạ, icon, mũi tên, nút GitHub như bản gốc - end -->
              Không gói trả phí, không giới hạn số đề. Khóa Gemini là của bạn, lưu mã hóa trong tài
              khoản và chỉ dùng để đọc đề bạn tải lên.
            </p>
          </div>
          <ul
            class="grid gap-2.5 rounded-lg border border-white/30 bg-white/10 p-4 dark:border-gray-900/30 dark:bg-gray-900/10"
          >
            @for (t of freeTicks; track t) {
              <!-- Haihs: khôi phục ảnh minh hoạ, icon, mũi tên, nút GitHub như bản gốc - start -->
              <!-- đóng code cũ -->
              <!-- <li class="flex gap-2.5"><span aria-hidden="true">✓</span>{{ t }}</li> -->
              <li class="flex gap-2.5">
                <app-icon name="check" svgClass="mt-1 h-5 w-5 flex-none" />{{ t }}
              </li>
              <!-- Haihs: khôi phục ảnh minh hoạ, icon, mũi tên, nút GitHub như bản gốc - end -->
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
                Cần Node.js 22 trở lên. Khi phát triển, MongoDB là tùy chọn: không đặt MONGODB_URI
                thì API tự dùng MongoDB in-memory (dữ liệu mất khi dừng). Khi triển khai thật cần
                <!-- Haihs: khôi phục ảnh minh hoạ, icon, mũi tên, nút GitHub như bản gốc - start -->
                <!-- đóng code cũ -->
                <!-- MongoDB, đặt qua biến MONGODB_URI (xem apps/api/.env.example), chạy một instance -->
                <!-- duy nhất sau reverse proxy cùng origin; mỗi giáo viên dùng Gemini API Key riêng. -->
                <!-- Xem README để biết chi tiết. -->
                MongoDB, đặt qua biến MONGODB_URI (xem apps/api/.env.example), chạy một instance duy
                nhất sau reverse proxy cùng origin; mỗi giáo viên dùng Gemini API Key riêng. Xem
                README để biết chi tiết.
                <!-- Haihs: khôi phục ảnh minh hoạ, icon, mũi tên, nút GitHub như bản gốc - end -->
              </p>
              <div class="relative rounded-lg bg-gray-950 p-4 text-gray-200">
                <button
                  type="button"
                  (click)="copy()"
                  class="absolute right-2 top-2 inline-flex min-h-[36px] items-center rounded border border-gray-700 bg-gray-800 px-3 text-sm font-semibold text-gray-200 hover:bg-gray-700"
                >
                  <!-- Haihs: khôi phục ảnh minh hoạ, icon, mũi tên, nút GitHub như bản gốc - start -->
                  <!-- đóng code cũ -->
                  <!-- {{ copied() ? 'Đã sao chép' : 'Sao chép' }} -->
                  <app-icon name="copy" svgClass="h-4 w-4" class="mr-1.5" />{{
                    copied() ? 'Đã sao chép' : 'Sao chép'
                  }}
                  <!-- Haihs: khôi phục ảnh minh hoạ, icon, mũi tên, nút GitHub như bản gốc - end -->
                  <span class="sr-only"> các lệnh</span>
                </button>
                <pre
                  class="m-0 overflow-x-auto pt-8 font-mono text-sm leading-7"
                ><code>{{ commands }}</code></pre>
                <!-- Haihs: khôi phục ảnh minh hoạ, icon, mũi tên, nút GitHub như bản gốc - start -->
              </div>
              <div>
                <ng-container
                  *ngTemplateOutlet="pill; context: { label: 'Xem mã nguồn trên GitHub' }"
                />
                <!-- Haihs: khôi phục ảnh minh hoạ, icon, mũi tên, nút GitHub như bản gốc - end -->
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
          <!-- Haihs: khôi phục ảnh minh hoạ, icon, mũi tên, nút GitHub như bản gốc - start -->
          <!-- đóng code cũ -->
          <!-- <div class="min-w-0"> -->
          <!-- <h2 class="text-base font-semibold text-gray-900 dark:text-gray-100"> -->
          <!-- Cam kết về Gemini API Key của bạn -->
          <!-- </h2> -->
          <!-- <p class="mt-1 max-w-[80ch] text-[15px] leading-relaxed"> -->
          <!-- Khóa Gemini chỉ được lưu giữ để tạo đề thi cho chính bạn. Chúng tôi không thu thập, -->
          <!-- không chia sẻ và không dùng khóa của bạn vào bất kỳ việc nào khác. Bạn có thể xóa khóa -->
          <!-- khỏi tài khoản bất cứ lúc nào. -->
          <!-- </p> -->
          <div class="flex items-start gap-3">
            <app-icon
              name="shield"
              class="mt-1 flex-none"
              svgClass="h-6 w-6 text-primary-700 dark:text-sky-400"
            />
            <div class="min-w-0">
              <h2 class="text-base font-semibold text-gray-900 dark:text-gray-100">
                Cam kết về Gemini API Key của bạn
              </h2>
              <p class="mt-1 max-w-[80ch] text-[15px] leading-relaxed">
                Khóa Gemini chỉ được lưu giữ để tạo đề thi cho chính bạn. Chúng tôi không thu thập,
                không chia sẻ và không dùng khóa của bạn vào bất kỳ việc nào khác. Bạn có thể xóa
                khóa khỏi tài khoản bất cứ lúc nào.
              </p>
            </div>
            <!-- Haihs: khôi phục ảnh minh hoạ, icon, mũi tên, nút GitHub như bản gốc - end -->
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
              <!-- Haihs: khôi phục ảnh minh hoạ, icon, mũi tên, nút GitHub như bản gốc - start -->
              <a
                [href]="repoUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="hover:text-primary-700 hover:underline dark:hover:text-sky-300"
                >GitHub</a
              >
              <!-- Haihs: khôi phục ảnh minh hoạ, icon, mũi tên, nút GitHub như bản gốc - end -->
            </span>
          </div>
        </div>
      </footer>
    </div>
    <!-- Haihs: khôi phục ảnh minh hoạ, icon, mũi tên, nút GitHub như bản gốc - start -->

    <ng-template #pill let-label="label">
      <a [href]="repoUrl" target="_blank" rel="noopener noreferrer" [class]="pillCls">
        <app-icon name="github" svgClass="h-[18px] w-[18px]" />
        <app-icon name="star" svgClass="h-[18px] w-[18px] fill-amber-500 text-amber-500" />
        <span>{{ label }}</span>
        @if (stars()) {
          <span
            class="font-medium text-gray-500 dark:text-gray-400"
            [class]="mono"
            [attr.aria-label]="stars() + ' sao'"
            >{{ stars() }}</span
          >
        }
      </a>
    </ng-template>
    <!-- Haihs: khôi phục ảnh minh hoạ, icon, mũi tên, nút GitHub như bản gốc - end -->
  `,
})
export class About {
  protected readonly wrap = WRAP;
  protected readonly eyebrow = EYEBROW;
  protected readonly h2 = H2;
  protected readonly muted = MUTED;
  // Haihs: khôi phục ảnh minh hoạ, icon, mũi tên, nút GitHub như bản gốc - start
  protected readonly peek = PEEK;
  protected readonly cap = CAP;
  protected readonly opt = OPT;
  protected readonly optOn = OPT_ON;
  protected readonly mono = MONO;
  protected readonly bOk = B_OK;
  protected readonly bWarn = B_WARN;
  protected readonly bBad = B_BAD;
  protected readonly bBrand = B_BRAND;
  protected readonly bGray = B_GRAY;
  protected readonly pillCls = PILL;
  protected readonly iconOk = ICON_OK;
  protected readonly repoUrl = REPO_URL;
  protected readonly heroOpts = [
    ['A', 'go'],
    ['B', 'goes'],
    ['C', 'going'],
    ['D', 'gone'],
  ];
  protected readonly shuffled = [
    { who: 'Học sinh A', opts: ['goes', 'go', 'gone', 'going'] },
    { who: 'Học sinh B', opts: ['going', 'gone', 'goes', 'go'] },
  ];
  protected readonly settings = ['Đảo thứ tự câu hỏi', 'Chống gian lận'];
  protected readonly stars = signal('');
  // Haihs: khôi phục ảnh minh hoạ, icon, mũi tên, nút GitHub như bản gốc - end
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

  // Haihs: khôi phục ảnh minh hoạ, icon, mũi tên, nút GitHub như bản gốc - start
  constructor() {
    // Live star count from the public GitHub API; any failure (offline / rate limit) just hides the number.
    if (typeof fetch === 'function') {
      fetch(STARS_API, { headers: { Accept: 'application/vnd.github+json' } })
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { stargazers_count?: number } | null) => {
          if (d) this.stars.set(formatStars(d.stargazers_count ?? NaN));
        })
        .catch(() => undefined);
    }
  }

  // Haihs: khôi phục ảnh minh hoạ, icon, mũi tên, nút GitHub như bản gốc - end
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
