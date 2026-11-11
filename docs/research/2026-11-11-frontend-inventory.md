# Kiểm kê frontend app nguồn (React + Vite + Tailwind) để port sang Angular

- Ngày: 2026-11-11. Nguồn: `/home/haihs/workspace/doc-to-exam-multi/ts_doc_to_exam_ai/client` (viết tắt `C/`), docs ở `.../ts_doc_to_exam_ai/docs`.
- Phạm vi đọc: `C/src` (App, context, services, pages, components, utils), `tailwind.config.js`, `index.css`, `index.html`, `vite.config.js`, danh sách `C/tests`; lướt `docs/design/2026-11-04-dong-bo-ui-ux.md` và `docs/handoff/2026-11-04-dong-bo-ui-ux.md`. Không chạy gì.
- Quy mô: 21 trang + 1 tab (`ClassResultsTab`), 53 component (+`dropdownStyles.js`), 46 utils + 2 services; ~45 file test `node:test` thuần (không có test render React) toàn bộ nhắm vào utils.
- Lưu ý đính chính so với đề bài: app nguồn KHÔNG có fullscreen, KHÔNG có device fingerprint, KHÔNG có zip (xem mục 6). Chống gian lận chỉ là visibility/blur/clipboard/contextmenu/file-picker.

## 1. Route, guard, layout

Router: `BrowserRouter`, `C/src/App.jsx:177-` (số dòng gần đúng, file chứa nhiều comment code cũ). Guard = `ProtectedRoute roles={[...]}` (`components/ProtectedRoute.jsx:1-74`) + hàm thuần `decideRoute` (`utils/authRouting.js:21`).

| Path | Trang | Vai trò | Guard / ghi chú |
|---|---|---|---|
| `/` | `RootRoute` (App.jsx) | tất cả | Khách -> `/about`; student -> `/sittings`; teacher -> `/teacher/templates` |
| `/about` | About | công khai | không guard |
| `/login`, `/register` | Login/Register `audience="student"` | công khai | Đã đăng nhập thì Login `<Navigate>` về home |
| `/teacher/login`, `/teacher/register` | Login/Register `audience="teacher"` | công khai | Đăng ký giáo viên cần `secretKey` (hint từ `VITE_TEACHER_SECRET_HINT`) |
| `/change-password` | ChangePassword | mọi người đã đăng nhập | Là route duy nhất vào được khi `mustChangePassword` |
| `/join`, `/join/:token` | JoinClass | đã đăng nhập (mọi vai trò) | token từ URL hoặc dán link (`parseInviteToken`) |
| `/classes`, `/classes/:classId` | MyClasses, MyClassDetail | student | |
| `/sittings` | MySittings | student | nhận `location.state.notice` (link `/exam/*` cũ) |
| `/ca/:code` | SittingEntry | student + teacher | teacher vào làm thử (server chỉ cho người tạo ca) |
| `/ca/:code/room` | ExamRoom | student + teacher | ẩn Navbar, ẩn ScrollToTop |
| `/ca/:code/done` | ExamSuccess | student + teacher | ẩn Navbar |
| `/ca/:code/result` | SittingResult | student + teacher | HIỆN Navbar (regex loại trừ ở Navbar) |
| `/exam/:idOrSlug[/room|/success]` | (redirect) | - | `<Navigate to="/sittings" state={{notice: LEGACY_LINK_NOTICE}}>` |
| `/teacher/classes`, `/teacher/classes/:id` | TeacherClasses, TeacherClassDetail | teacher | Detail có 4 tab state cục bộ: teachers/students/invite/results (`TeacherClassDetail.jsx:24`) |
| `/teacher/templates`, `/new`, `/:id/edit` | TeacherTemplates, TemplateEditor | teacher | Editor nhận `location.state.draftExam` (đề vừa parse) + `sessionStorage 'draft_template'` |
| `/teacher/sittings`, `/new`, `/:id`, `/:id/edit` | TeacherSittings, SittingCreate, TeacherSittingDetail, SittingEditor | teacher | Create đọc `?templateId` (searchParams); Detail đọc `?tab=` |
| `*` | `<Navigate to="/">` | - | |

`decideRoute` thứ tự: chưa đăng nhập -> (login theo audience: roles chỉ `['teacher']` -> `/teacher/login`, còn lại `/login`, kèm `state.from`) -> `mustChangePassword` -> `/change-password` -> sai vai trò -> `/`. Sau login: `postLoginPath` (`authRouting.js:32`).

Layout (`App.jsx` `AppContent`): `div.min-h-screen.flex-col` > `ApiProgress` (thanh tiến trình, `animation-progress`) > `Navbar` (sticky, h=`--nav-h` 4.25rem; trả `null` ở `/ca/*` trừ `/result`) > `div.flex-1.2xl:max-w-[1920px]` chứa `Routes` > `ApiKeyModal` (chỉ render nếu `isTeacher`). Bọc ngoài: `AuthProvider > Router > AlertProvider > (AppContent + ScrollToTop)`. Mỗi trang tự đặt `.container-fluid` (padding 4/6/8). Navbar: link theo vai trò, `ActionMenu` cho màn nhỏ, `ThemeToggle`, nút API Key (teacher), `ConfirmModal` đăng xuất.

## 2. Từng trang (21)

Quy ước: "API" dùng tên hàm trong `services/api.js`. Mọi trang tải dữ liệu đều có 3 trạng thái: Skeleton (loading) / thông báo lỗi inline có "Thử lại" (lỗi TẢI) / `alert.error` popup (lỗi hành động) - chuẩn UX đã chốt ở design 2026-11-04 mục 2 (ý 21).

| # | Trang (dòng) | Mục đích / API | State chính | Luồng, lỗi, loading |
|---|---|---|---|---|
| 1 | About (326) | Giới thiệu công khai, GitHub stars (`utils/githubStars.js`, fetch API GitHub) | tĩnh + stars | Lỗi stars bỏ qua im lặng |
| 2 | Login (290) | `login(audience, phone, pw)` -> `/auth/{student,teacher}/login` | form, errors map, show-pw | Validate map (`authRules.validateLoginForm`) hiện dưới ô, focus ô lỗi đầu; lỗi server -> popup; thành công `navigate(postLoginPath)` |
| 3 | Register (512) | `registerByAudience`; teacher thêm `secretKey` | form + errors | Như Login; giữ `location.state` (đang định vào `/join/:token`) |
| 4 | ChangePassword (219) | `changePasswordApi`, `logoutAllApi` | form | Đổi xong token mới được lưu (`applyAuth`); "đăng xuất mọi thiết bị" qua ConfirmModal |
| 5 | JoinClass (129) | `joinClass(token)` -> `/classes/join` | token | Có `:token` thì tự gọi; kết quả "đã vào"/"chờ duyệt"; lỗi hiện thông báo |
| 6 | MyClasses (174) | `getMyClasses`, `leaveMyClass` | list | ConfirmModal rời lớp; skeleton |
| 7 | MyClassDetail (173) | `getMyClassDetail`, `leaveMyClass` | detail | Danh sách ca của lớp, nút vào `/ca/:code` |
| 8 | MySittings (174) | `listMySittings` (phân trang `Pager`) | page, items, notice | Banner `location.state.notice`; trạng thái `myState` (chưa làm/đang làm/đã nộp...) |
| 9 | SittingEntry (200) | `resolveSittingCode(code)` -> `/me/sittings/resolve` | sitting, failure | Hiển thị ca, `canStartSitting(myState)`; lỗi `not_granted` -> `SittingNotGranted`; nút "Bắt đầu/Làm tiếp" -> `/ca/:code/room` |
| 10 | ExamRoom (1074) | PHÒNG THI. `resolveSittingCode` -> `startMySitting` -> (resync) `getMySittingSession` -> `submitMySitting`; upload tự luận `uploadEssayFile` | exam, answers, essayTexts/Files (+refs), remainingSeconds, violationsRef, flags submit | Chi tiết mục 6. Lỗi tải: `describeSittingError` (`submitted` -> `/done`, `not_granted` -> màn riêng). Nộp: retry 3 lần (1.5s*n), `classifySubmitFailure` (`done`/`stop`/retry). Draft sessionStorage. |
| 11 | ExamSuccess (253) | Kết quả sau nộp; đọc `sessionStorage submission_result_<code>`, thiếu thì `resolveSittingCode` | result | Confetti 1 lần khi mount (try/catch); `UploadLostNotice` khi `warnings` chứa `upload_lost`; ẩn điểm nếu có tự luận; chưa nộp -> về `/ca/:code` |
| 12 | SittingResult (358) | `getMySittingResult`, `fetchMySittingEssayMedia` (blob, 410 = ảnh hết hạn) | state {status,data} | loading/error/ok; lỗi: chưa công bố, đang cập nhật, chưa nộp (`studentResult.describeResultError`); `FormattedText` hiển thị đề |
| 13 | TeacherClasses (411) | `listClasses`, `createClass`, `updateClass`, `deleteClass`, `restoreClass` | tab active/deleted, page, modal | `ClassForm` modal; `ClassRestoreCodeModal` khi 409 CLASS_CODE_TAKEN; ActionMenu |
| 14 | TeacherClassDetail (236) | `getClass`, `updateClass`, `deleteClass`, `restoreClass` + 4 tab | tab, class | Tab: `ClassTeachersTab`, `ClassStudentsTab`(+Import, StudentModals), `ClassInviteTab`(QR), `ClassResultsTab` |
| 15 | TeacherTemplates (464) | `listTemplates`, `parseTemplateFile` (upload+AI), `duplicateTemplate`, `deleteTemplate`, trash tab | list, page, q, tab | Parse file -> `navigate('/teacher/templates/new', {state:{draftExam}})`; thiếu key -> `requestOpenApiKeyModal()` (event) khi `requireApiKey`; `createSingleFlight` chống đúp "Tạo bản sao" |
| 16 | TemplateEditor (391) | `getTemplate`, `createTemplate`, `updateTemplate` | questions, mode edit/preview, errors map | Nạp draft từ `location.state`/sessionStorage; validate `templateForm`+`examQuestions`; lưu xong popup success PHẢI bấm OK rồi mới điều hướng |
| 17 | TeacherSittings (188) | `listSittings` (lọc lớp qua `SearchSelect`, trạng thái qua `Select`), `listClasses` | filters, page | |
| 18 | SittingCreate (552) | `listTemplates` (fetchAllPages), `listClasses`, `listSittingCandidates`, `createSitting` | form, classes[], selection học sinh | Validate `validateSittingForm`; giờ nhập mask `dd/mm/yyyy hh:mm` UTC+7; 409 `SITTING_OVERLAP` |
| 19 | TeacherSittingDetail (204) | `getSitting`, `deleteSitting` + panel con | tab (`?tab=`) | Panels: Code(QR), Schedule, Classes, Grants, Results(+`EssayManualPanel`), `ResultsPublishCard` |
| 20 | SittingEditor (386) | `getSitting`, `updateSitting` | form + questions, locked/readOnly | Ca khóa -> readOnly; cài đặt ca ẩn bằng CSS (không unmount) ở chế độ xem để giữ state |
| 21 | ClassResultsTab (89, tab, không route) | `listSittings({classId})` + `SittingResultsPanel`, chọn ca bằng `SearchSelect` | state {error,...} | Lỗi -> `alert.error` |

Ghi chú: `pages/` có 21 file `.jsx` gồm `ClassResultsTab` (không có route riêng). Route thật = 20 trang + 1 tab.

API hoàn chỉnh: `services/api.js` (407 dòng) - nhóm auth, me (classes/sittings), classes (CRUD, invite, teachers, students, import), templates, sittings (CRUD, grants, results, xlsx, grading, publication), `essay-uploads`. Hàm `idPath` encode id; `fetchAllPages` (api.js:318) đọc hết phân trang limit 50.

## 3. Component dùng chung (53) và utils (46)

### 3.1 Component theo chức năng

| Nhóm | Component |
|---|---|
| Khung/điều hướng | `Navbar`, `ProtectedRoute`, `ScrollToTop`, `ThemeToggle`, `ApiProgress`, `ActionMenu`, `Pager`, `Skeleton`, `StatsCaption` |
| Popup/thông báo | `AlertModal` (variant success/error/warning + secondaryLabel), `AlertProvider` (+`useAlert`, hàng đợi FIFO), `ConfirmModal`, `ApiKeyModal`, `UploadLostNotice`, `ManualGradingNotice`, `SittingNotGranted` |
| Form/field | `FormField` (nhãn, `*` đỏ, lỗi, aria), `PasswordField`, `Select`, `SearchSelect`, `ScoreCombobox`, `DateTimeField`, `DateTimePicker`, `dropdownStyles.js` |
| Soạn đề | `QuestionsEditor`, `QuestionCard`, `QuestionList`, `QuestionPalette`, `EssayQuestionEditor`, `EssayEditorParts`, `FormattedText` (render `<u><b><i><mark><br>` + `**`, KHÔNG dùng innerHTML) |
| Phòng thi | `Timer` (đếm theo mốc deadline), `EssayAnswer`, `QuestionPalette`, `QuestionList` |
| Lớp | `ClassForm`, `ClassImportPanel`, `ClassInviteTab` (QR), `ClassTeachersTab`, `ClassStudentsTab`, `ClassRestoreCodeModal`, `StudentModals` |
| Ca thi | `SittingCodePanel` (QR), `SittingSchedulePanel`, `SittingClassesPanel`, `SittingGrantsTab`, `SittingSettingsFields`, `SittingResultsPanel` (722 dòng, lớn nhất), `SittingSubmissionModal`, `ResultsPublishCard`, `TemplateTrashTab` |
| Chấm/điểm | `EssayManualPanel` (716), `GradingScoreCells`, `ScoreBadge`, `ScoreSummaryLine` |

Component lớn cần chia nhỏ khi port: `SittingResultsPanel`, `EssayManualPanel`, `QuestionsEditor`, `ExamRoom`, `Navbar`, `ClassStudentsTab`.

### 3.2 Utils theo chức năng (đánh dấu: **PORT+TEST** = logic thuần cần port nguyên văn và có test đi kèm; test nguồn có sẵn ở `C/tests/<tên>.test.js`, dùng làm bộ test vàng)

| Nhóm | File | Ghi chú |
|---|---|---|
| Chống gian lận | `antiCheatRules.js` **PORT+TEST** | `decideAntiCheatAction`, `resolveFilePickerClose` (grace 1s, 30s/lần, 30s tổng) |
| Mạng/retry | `retry.js` **PORT+TEST** (`retryWithBackoff`, backoff+jitter, Retry-After, `isRetryableError`), `apiErrors.js` **PORT+TEST**, `apiActivity.js` (đếm request, chặn click khi đang ghi, `data-allow-busy`), `duplicateExam.js` **PORT+TEST** (`createSingleFlight`) |
| Upload tự luận | `essayRules.js` **PORT+TEST** (giới hạn ký tự/byte, loại tệp, `buildEssayAnswersPayload`), `essayUploadFlow.js` **PORT+TEST** (kiểm -> nén -> upload retry, 6 lần), `uploadSession.js` **PORT+TEST** (`createUploadTracker`, AbortController theo câu), `imageCompress.js` **PORT+TEST** (phần tính toán thuần; `compressImage` dùng canvas/`createImageBitmap` - cần adapter trình duyệt) |
| CSV/xuất file | `csv.js` **PORT+TEST** (`toCsvCell` chống formula injection), `studentImport.js` (CSV mật khẩu/mẫu, ngưỡng import), `sittingResults.js` (CSV cũ + `fileNameFromDisposition`), `browser.js` (clipboard, `downloadTextFile`, `safeFileName`), `passwordCopy.js`, `tempPasswordStore.js` |
| Auth/routing | `authRouting.js` **PORT+TEST** (-> CanActivateFn), `authRules.js` **PORT+TEST**, `inviteToken.js`, `passwordVisibility.js` |
| Soạn đề / điểm | `examQuestions.js` **PORT+TEST** (385 dòng: validate, thang 10 điểm, `redistributeCriteria`, `toPayloadQuestion`), `templateForm.js`, `templateTrash.js`, `limits.js` (255/100/30; phải khớp server), `score.js`, `scoreCombobox.js` |
| Chấm tự luận | `manualGrading.js` **PORT+TEST** (308 dòng, `createLatestGate`, `saveBlockReason`, `classifySaveError`), `gradingView.js` **PORT+TEST**, `essayScoreRedistribute` (test) |
| Ca thi/lớp | `sittingRules.js` **PORT+TEST** (285), `studentSitting.js` (`classifySubmitFailure`, `arrangeQuestions`), `studentResult.js`, `sittingResults.js`, `resultsPublication.js` (có `createLatestOnly`), `classRules.js`, `classUi.js`, `classPicker.js`, `editorMode.js` |
| Ngày giờ | `dateFormat.js` **PORT+TEST** (UTC+7 cố định), `dateTimeInput.js` **PORT+TEST** (mask, parse), `dateTimeField.js` |
| UI helper thuần | `alertQueue.js`, `scrollToTop.js`, `searchSelect.js` (`createRequestGate`, `mergePages`, `nextActiveIndex`), `select.js` (typeahead), `formErrors.js` (`focusFirstError`), `formFieldChildren.js` (chỉ để React clone, bỏ khi port), `apiKeyModal.js` (event), `githubStars.js` |

Hàm "race guard" cần giữ ngữ nghĩa: `createRequestGate`, `createLatestGate`, `createLatestOnly`, `createSingleFlight`, `createUploadTracker` (trên Angular thay bằng `switchMap`/`AbortController` nhưng phải giữ hành vi test hiện có).

## 4. Auth, theme, alert, modal API key

- Token: `localStorage['auth_token']` (`api.js:13`); khóa cũ `teacher_auth_token` bị xóa khi load module (`api.js:14`). Không refresh token.
- Interceptor request (`api.js:17`): gắn `Authorization: Bearer`, `beginRequest`. Response (`api.js:27`): `endRequest`; `classifyAuthError`: 401 -> xóa token + `window.dispatchEvent(UNAUTHENTICATED_EVENT 'auth:unauthenticated')`; 403 `MUST_CHANGE_PASSWORD` -> event `'auth:must-change-password'` (KHÔNG đăng xuất, chỉ set `user.mustChangePassword`).
- `AuthContext.jsx`: state `user, token, isLoading, loadError`; `loadUser` gọi `/auth/me` khi mount nếu có token: 401 -> `logout`; lỗi khác -> `loadError` + nút "Thử lại" (GIỮ token). Listener hai event ở `:90-96`. API: `login/register/changePassword` -> `applyAuth` ghi token; `logoutAll`; `updateApiKey` (PUT `/auth/api-key`, cập nhật `hasApiKey`, `apiKeyLast4`); cờ `isTeacher/isStudent/isAuthenticated`.
- Upload tự luận dùng `publicApi` riêng (không interceptor) + header `X-Upload-Token` + tự gắn Bearer (`api.js:257-275`).
- Theme: `ThemeToggle` + script inline trong `index.html` áp class `dark` lên `<html>` TRƯỚC khi vẽ; khóa `localStorage['theme']` ('light'|'dark'; chưa có/`system` cũ -> theo `prefers-color-scheme` một lần). `darkMode: 'class'`.
- `AlertProvider`/`useAlert`: `success|error|warning(message, {title, secondaryLabel, onSecondary})` trả Promise resolve khi đóng; hàng đợi FIFO, gộp trùng liên tiếp; một popup tại một thời điểm; nằm trên `Routes` nên không mất khi đổi trang. ExamRoom dùng cho "Cảnh báo vi phạm".
- Modal API key: mở bằng `CustomEvent 'open-api-key-modal'` (`utils/apiKeyModal.js`) từ bất kỳ trang (EssayEditorParts, TeacherTemplates, bảng điểm) hoặc Navbar; `App` lắng nghe, chỉ render khi `isTeacher`. Xóa key dùng `window.confirm` (nên đổi sang ConfirmModal khi port).

## 5. Tailwind: token cần giữ

- `tailwind.config.js` (75 dòng): `darkMode:'class'`; font `"Be Vietnam Pro"` (Google Fonts 400/500/600) + Roboto fallback; `html{font-size:17px}` (chữ lớn cho giáo viên lớn tuổi, mọi rem scale theo).
- Màu: MỘT thang accent `brand` (tím nhạt: 50 `#f7f5ff` ... 700 `#6d4fd6` ... 900 `#43308a`) được gán alias cho `primary, sky, blue, violet, indigo` (nên class như `sky-400` ở dark = tím 400 `#b39dfa`); thang xám `ink` (zinc) alias `gray, slate`. => Khi port phải giữ ALIAS này hoặc đổi class đồng loạt, nếu không mọi `dark:bg-sky-400`, `bg-primary-700` sẽ sai màu.
- `borderRadius` ép: `lg .375rem`, `xl/2xl/3xl .5rem`; `fontWeight` bold/extrabold/black = 600 (chống "AI slop").
- `boxShadow`: `raised`, `floating`, `overlay`, `field(none)` + `*-dark`. `keyframes/animation: progress` (thanh tiến trình API).
- `index.css` (257 dòng): biến `--nav-h: 4.25rem`, `--sticky-h: 7rem`; `scroll-padding-top`, `scroll-behavior:smooth`; focus ring `3px #6d4fd6` (dark `#b39dfa`); `input/select/textarea min-height 48px`, `button min-height 44px` (a11y chạm); checkbox/radio accent tím.
- Class component (`@layer components`): `.btn`, `.btn-primary/-secondary/-danger/-ghost`, `.card`, `.card-hover`, `.card-header`, `.section-band`, `.field-inset`, `.input`, `.row-hover`, `.container-fluid`, `.page-header/.page-title/.page-subtitle`, `.empty-state`, `.badge`, `.link-accent`. Dùng `@apply` nên copy nguyên `index.css` + config là tái dùng được toàn bộ giao diện.
- Cảnh báo: cả hai file chứa rất nhiều comment "đóng code cũ" (quy ước WF-DEV-14 của nguồn); chỉ lấy dòng đang hoạt động khi copy. Phiên bản Tailwind nguồn 3.4 (`line-clamp-*` có sẵn); Angular mới nên cân nhắc giữ 3.4 để khỏi đổi cú pháp `@apply`/config.
- Icon: `lucide-react` -> Angular dùng `lucide-angular`. Dep khác: `qrcode.react` (`QRCodeSVG`, 128px), `canvas-confetti`, `axios`, `clsx`, `tailwind-merge` (bỏ khi port; dùng `[class]`/`ngClass`).

## 6. Bẫy khi port React -> Angular (standalone + signals)

| Chủ đề | Bẫy | Gợi ý |
|---|---|---|
| Form | Không có thư viện form: state cục bộ + hàm thuần `validate*` trả MAP `{field: msg}`; lỗi hiện dưới ô, bấm lưu thì cuộn+focus ô lỗi đầu (`formErrors.focusFirstError`), sau đó revalidate khi đổi giá trị; BỎ `required` native và dùng `noValidate`; dấu `*` đỏ qua prop `required` của `FormField`; `maxLength` HTML không cắt dữ liệu cũ >255 nên vẫn phải validate. | Dùng signals + hàm thuần giữ nguyên, hoặc Reactive Forms với validator wrap hàm thuần; KHÔNG dùng `Validators.required` mặc định (sai thứ tự thông báo, sai bố cục). `FormField` -> component có `ng-content` + `aria-describedby` |
| Guard | `ProtectedRoute` còn có UI trung gian: spinner khi `isLoading`, thẻ "Thử lại" khi `loadError`, và `state.from` để quay lại sau login | `CanActivateFn` không render UI được: cần `resolve`/đợi signal `isLoading` hoặc shell component hiển thị trạng thái; `Router.createUrlTree` + `state` thay `Navigate state` |
| Role theo path | `roles` khác nhau cho `/ca/*` (cả student+teacher) | `data: {roles}` + 1 guard; hàm `decideRoute` port nguyên |
| Interceptor | Hai instance axios (có/không interceptor); axios `timeout 120s`; blob error cần parse lại JSON (`downloadSittingResultsXlsx`) ; `onUploadProgress` | `HttpInterceptorFn`; upload tiến độ cần `reportProgress:true, observe:'events'`; instance "public" = `HttpContext` token để bỏ qua interceptor; timeout tự thêm bằng `timeout()` rxjs; hủy bằng `AbortSignal` -> `takeUntil` |
| Sự kiện 401 | `window` CustomEvent gắn nhiều chỗ | Thay bằng service/Subject; nhưng giữ test hành vi: 401 xóa token, `MUST_CHANGE_PASSWORD` không logout |
| Tracker request | `apiActivity` chặn click/submit ở pha capture khi có request ghi đang bay, trừ vùng `data-allow-busy` (phòng thi) | Port nguyên listener document capture + signal đếm; vẫn cần `data-allow-busy` ở ExamRoom |
| Chống gian lận (ExamRoom) | Các listener: `visibilitychange`, `window blur/focus`, `copy/cut/paste/drop/contextmenu` (loại trừ vùng `[data-essay-input]`), `click/change/cancel` capture để phát hiện hộp chọn tệp, `beforeunload`, `pagehide` (lưu draft). Debounce ghi vi phạm 1500ms (`lastLoggedAtRef`); vi phạm lưu ở ref, gửi kèm `tabViolations` khi nộp; popup cảnh báo không chồng (`warningOpenRef`). Sự kiện `cancel` trên input file không bubble trong mọi trình duyệt. | Đăng ký trong `afterNextRender`/effect + cleanup bằng `DestroyRef`; chạy ngoài `NgZone` (`runOutsideAngular`) cho blur/visibility để tránh change detection thừa; giữ state vi phạm trong biến thường chứ không signal; KHÔNG có fullscreen/fingerprint ở nguồn, đừng thêm nếu spec không yêu cầu |
| Đồng hồ | `Timer` đếm theo `Date.now()` mốc deadline (tick 250ms), `onTimeUp` đúng 1 lần; resync server mỗi 60s và khi `visibilitychange` | `effect` + `setInterval` trong zone ngoài; tránh `interval(1000)` cộng dồn |
| Nộp bài | `hasSubmittedRef`, `unmountedRef` (StrictMode mount 2 lần), retry 3 lần với delay `attempt*1500`, `classifySubmitFailure` (done/stop/retry), chờ upload dở (`AUTO_SUBMIT_UPLOAD_WAIT_MS` 20s khi tự nộp), `INVALID_UPLOAD` đánh dấu tệp hỏng | Angular không có StrictMode double-mount nhưng vẫn cần cờ destroyed; dùng `firstValueFrom` + vòng lặp để giữ đúng thứ tự |
| Draft | `sessionStorage`: `draft_answers_<id>`, `draft_essay_<id>`, `draft_essay_files_<id>`, `submission_result_<code>`, `draft_template` | Giữ NGUYÊN khóa; bọc try/catch (private mode) |
| Upload tự luận | `createUploadTracker` hủy lượt cũ khi đổi tệp; nén ảnh canvas (cạnh tối đa, JPEG quality steps); `X-Upload-Token` giữ khi F5 | Giữ hàm thuần, bọc `compressImage` làm service; test bằng bộ test nguồn |
| QR | `QRCodeSVG` (`SittingCodePanel.jsx:74`, `ClassInviteTab.jsx:64`) value = link, size 128 | `angularx-qrcode` hoặc `qrcode` sinh SVG; link dựng bằng `buildSittingLink`/`buildInviteLink` (dùng `window.location.origin`) |
| Confetti | `canvas-confetti` gọi 1 lần khi mount ExamSuccess, trong try/catch | Gọi trong `afterNextRender`; kiểm tra `prefers-reduced-motion` nếu muốn |
| Dropdown tự viết | `Select`, `SearchSelect`, `ScoreCombobox`, `DateTimeField`: bàn phím (mũi tên/Enter/Esc/typeahead), `role=listbox/combobox`, `aria-activedescendant`, SearchSelect phân trang + `createRequestGate`; Tab vào ô điểm không tự mở; `showPicker()` trên `datetime-local` ẩn | Làm lại bằng CDK Overlay hoặc tự viết; KHÔNG dùng `<select>/<datalist>`/Material mặc định (đã chốt ý 7); handoff nói chưa test tay trên trình duyệt thật |
| Popup | `AlertProvider` Promise + `await alert.success(); navigate()` | Service trả `Promise`/`Observable` từ `signal` queue; giữ `alertdialog` a11y, Esc/click nền đóng, không tự đóng |
| Ngày giờ | Cố định UTC+7 cả hiển thị và khi gõ (`dateFormat`, `dateTimeInput`); không dùng `Intl` locale-phụ thuộc | Không dùng `DatePipe` mặc định (theo múi giờ trình duyệt); dùng hàm thuần |
| Xuất file | Kết quả ca -> `.xlsx` do server tạo (`/results/export.xlsx`, blob, tên từ `Content-Disposition`); CSV chỉ còn cho mật khẩu tạm + file mẫu import (`buildCsv`, chống formula injection) | `responseType:'blob'` + `URL.createObjectURL` + `<a download>`; ĐỪNG sinh xlsx ở client |
| Zip | KHÔNG có trong nguồn | Không port |
| Tab/URL state | Tab của TeacherClassDetail là state cục bộ; TeacherSittingDetail đọc `?tab=`; SittingCreate đọc `?templateId` | `withComponentInputBinding()` hoặc `ActivatedRoute.queryParamMap` |
| `location.state` | `draftExam` (TemplateEditor), `notice` (MySittings), `from` (login) | `router.navigate(..., {state})` + `history.state`; mất khi F5 nên giữ fallback sessionStorage như nguồn |
| `ScrollToTop` | Hiện khi cuộn >400px; ẩn ở `/ca/:code/room`; tôn trọng reduced-motion | `window:scroll` host listener hoặc `fromEvent` + `signal` |
| `FormattedText` | Parse thủ công thẻ cho phép, không `innerHTML` | Giữ parser thuần -> render bằng `@for` + span; tránh `[innerHTML]` (XSS + sanitizer cắt `<u>`/`<mark>`) |
| StrictMode | Nguồn chạy StrictMode; code đã xử lý effect chạy 2 lần | Không cần ở Angular nhưng giữ idempotency của effect |
| Số lượng test | Chỉ test utils (không render) | Giữ nguyên chiến lược: test hàm thuần bằng Vitest/Jest (chuyển từ `node:test`); component test tối thiểu |

## 7. Đề xuất milestone frontend (thứ tự phụ thuộc)

Nguyên tắc: nền móng (CI, lint, test infra, e2e smoke) ở M0 theo CLAUDE.md 1.2; utils thuần port trước kèm test; trang đơn giản trước, ExamRoom sau cùng của luồng học sinh.

| M | Nội dung | File nguồn chính |
|---|---|---|
| M0 Nền móng | Angular workspace standalone+signals, Tailwind 3.4 (copy config+`index.css`), font, script theme trước khi vẽ, lint/format, test runner, CI, Playwright smoke; proxy `/api` -> 5000 | `tailwind.config.js`, `src/index.css`, `index.html`, `vite.config.js`, `postcss.config.js` |
| M1 Utils thuần + test vàng | Port toàn bộ nhóm **PORT+TEST** ở mục 3.2 cùng 45 test nguồn; `limits`, `dateFormat`, `dateTimeInput`, `retry`, `csv`, `apiErrors`, `authRules/authRouting`, `antiCheatRules`, `essayRules`, `uploadSession`, `essayUploadFlow`, `duplicateExam`, `examQuestions`, `manualGrading`, `gradingView`, `sittingRules`, `studentSitting/Result`, `resultsPublication`, ... | `src/utils/*`, `tests/*.test.js` |
| M2 Core HTTP + Auth | `HttpInterceptor` (Bearer, 401, MUST_CHANGE_PASSWORD, apiActivity), `AuthService` (signals), guard, event bus, `apiActivity` guard, `api.ts` typed client | `services/api.js`, `context/AuthContext.jsx`, `utils/apiActivity.js`, `utils/apiErrors.js`, `components/ProtectedRoute.jsx` |
| M3 UI kit | `FormField`, `PasswordField`, `Select`, `SearchSelect`, `ScoreCombobox`, `DateTimeField/Picker`, `AlertModal`+`AlertProvider`, `ConfirmModal`, `Pager`, `Skeleton`, `ActionMenu`, `ThemeToggle`, `ApiProgress`, `ScrollToTop`, `Navbar`, `dropdownStyles` | `components/{FormField,PasswordField,Select,SearchSelect,ScoreCombobox,DateTimeField,DateTimePicker,AlertModal,AlertProvider,ConfirmModal,Pager,Skeleton,ActionMenu,ThemeToggle,ApiProgress,ScrollToTop,Navbar,StatsCaption,dropdownStyles}` |
| M4 Tài khoản + public | Layout/router, Login, Register, ChangePassword, About, JoinClass, `ApiKeyModal` | `pages/{Login,Register,ChangePassword,About,JoinClass}.jsx`, `components/ApiKeyModal.jsx`, `App.jsx` |
| M5 Lớp (giáo viên) | TeacherClasses, TeacherClassDetail, `ClassForm`, `ClassRestoreCodeModal`, `ClassTeachersTab`, `ClassStudentsTab`, `ClassImportPanel`, `ClassInviteTab` (QR), `StudentModals` | `pages/TeacherClasses.jsx`, `TeacherClassDetail.jsx`, `components/Class*`, `StudentModals.jsx`, `utils/class*.js`, `studentImport.js`, `inviteToken.js`, `tempPasswordStore.js`, `passwordCopy.js`, `browser.js` |
| M6 Đề mẫu + editor câu hỏi | TeacherTemplates (parse AI, duplicate, trash), TemplateEditor, `QuestionsEditor`, `QuestionCard`, `EssayQuestionEditor`, `EssayEditorParts`, `FormattedText`, `TemplateTrashTab` | `pages/TeacherTemplates.jsx`, `TemplateEditor.jsx`, `components/Question*`, `Essay{QuestionEditor,EditorParts}`, `FormattedText`, `TemplateTrashTab`, `utils/{examQuestions,templateForm,templateTrash,editorMode,duplicateExam}.js` |
| M7 Ca thi (giáo viên) | TeacherSittings, SittingCreate, SittingEditor, TeacherSittingDetail + `SittingSettingsFields`, `SittingCodePanel` (QR), `SittingSchedulePanel`, `SittingClassesPanel`, `SittingGrantsTab`, `ResultsPublishCard` | `pages/Teacher*Sitting*`, `SittingCreate`, `SittingEditor`, `components/Sitting*`, `ResultsPublishCard`, `utils/{sittingRules,resultsPublication,classPicker}.js` |
| M8 Kết quả + chấm tự luận | `SittingResultsPanel`, `EssayManualPanel`, `GradingScoreCells`, `ManualGradingNotice`, `ScoreBadge`, `ScoreSummaryLine`, `ClassResultsTab`, tải `.xlsx` | `components/{SittingResultsPanel,EssayManualPanel,GradingScoreCells,ManualGradingNotice,ScoreBadge,ScoreSummaryLine,SittingSubmissionModal,EssayAnswer}.jsx`, `pages/ClassResultsTab.jsx`, `utils/{manualGrading,gradingView,sittingResults,score,scoreCombobox}.js` |
| M9 Học sinh (không thi) | MyClasses, MyClassDetail, MySittings, SittingEntry, SittingNotGranted, SittingResult | `pages/{MyClasses,MyClassDetail,MySittings,SittingEntry,SittingResult}.jsx`, `components/SittingNotGranted.jsx`, `utils/{studentSitting,studentResult}.js` |
| M10 Phòng thi | ExamRoom, `Timer`, `QuestionList/Palette`, `EssayAnswer`, upload tự luận + nén ảnh, anti-cheat, ExamSuccess (confetti), `UploadLostNotice` | `pages/ExamRoom.jsx`, `ExamSuccess.jsx`, `components/{Timer,QuestionList,QuestionPalette,EssayAnswer,UploadLostNotice}.jsx`, `services/essayUpload.js`, `utils/{antiCheatRules,essayRules,essayUploadFlow,uploadSession,imageCompress,retry}.js` |
| M11 Hoàn thiện | a11y, 375px/1024px/1280px (bảng điểm không cuộn ngang), E2E luồng teacher + student, kiểm tay các điểm handoff liệt kê "CHƯA kiểm thử trên trình duyệt thật" | `docs/handoff/2026-11-04-dong-bo-ui-ux.md` mục "Vấn đề còn lại" |

Phụ thuộc: M1 -> M2 -> M3 -> (M4, M5, M6 song song) -> M7 (cần M5, M6) -> M8 (cần M7) ; M9 (cần M3, M2) ; M10 (cần M9 + M1) ; M11 cuối.

## 8. Rủi ro lớn nhất

1. ExamRoom (1074 dòng) trộn timer, anti-cheat, draft, upload, nộp retry, resync: dễ vỡ hành vi khi tách. Cần port hàm thuần trước (M1) rồi viết e2e đủ kịch bản (đổi tab, dán, file-picker, mạng rớt khi nộp, hết giờ tự nộp, F5).
2. Alias màu Tailwind (`primary/sky/blue/violet/indigo` -> brand, `gray/slate` -> ink) và class `@apply` trong `index.css`: sai một chỗ là lệch toàn bộ theme sáng/tối.
3. Bộ dropdown tự viết (`Select/SearchSelect/ScoreCombobox/DateTimeField`) với bàn phím/a11y và phân trang bất đồng bộ; handoff nguồn cũng thừa nhận CHƯA test tay trên trình duyệt thật.
4. Nhiều cơ chế race/concurrency ngầm (`createRequestGate`, `createLatestGate`, `createLatestOnly`, `createSingleFlight`, `createUploadTracker`, `apiActivity` chặn click toàn cục): đổi sang RxJS/signals dễ làm mất bảo đảm "chỉ kết quả mới nhất thắng".
5. Hợp đồng ngầm với server: `limits` 255/100/30 phải khớp, mã lỗi (`SITTING_OVERLAP`, `CLASS_CODE_TAKEN`, `INVALID_UPLOAD`, `MUST_CHANGE_PASSWORD`, `requireApiKey`, `field` trong lỗi), múi giờ UTC+7 cố định, xlsx do server tạo. Đề bài nêu zip/fullscreen/fingerprint nhưng nguồn không có: cần chốt lại spec để khỏi implement thừa hoặc thiếu.
