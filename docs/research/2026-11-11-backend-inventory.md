# Kiểm kê backend doc_to_exam_ai (nguồn: ts_doc_to_exam_ai/server)

Ngày: 2026-11-11. Trạng thái: nghiên cứu (chỉ đọc), phục vụ port sang TypeScript/Next.js Route Handlers.
Quy ước nguồn: `file:dòng` tính từ `/home/haihs/workspace/doc-to-exam-multi/ts_doc_to_exam_ai/server/`.
Ghi chú: file nguồn chứa nhiều comment "đóng code cũ"; bảng dưới chỉ phản ánh code đang chạy.

Phát hiện quan trọng trước tiên: **chấm tự luận bằng AI đã bị gỡ** (B1). Tự luận chỉ do giáo viên chấm tay (`models/SittingSubmission.js:66`, `index.js:30-39`). Gemini chỉ còn dùng để **tách đề từ file** (`POST /api/templates/parse`). Không có worker nền nào. Cũng không có job nào gọi `sweepUnattachedMedia` (chỉ test gọi, `services/essayUploadService.js:431`); chỉ có TTL index của Mongo dọn dữ liệu.

---

## 1. Cấu hình, middleware, rate limit, lỗi, response

### 1.1 Biến môi trường (`config/env.js`, `.env.example`)

| Biến | Mặc định / quy tắc | Nguồn |
|---|---|---|
| `NODE_ENV` | `production` bật kiểm tra chặt; `test` bỏ rate limit | env.js:16-17 |
| `PORT` | 5000 | env.js:152 |
| `MONGODB_URI` | bắt buộc ở production; dev không có thì thử `mongodb://127.0.0.1:27017/doc_to_exam_db` rồi rơi về in-memory | env.js:176, db.js:4,36-86 |
| `ALLOW_IN_MEMORY_DB` | `true` ở dev, `false` ở prod; bật ở prod chỉ cảnh báo | env.js:164 |
| `JWT_SECRET` | >=16 ký tự; dev tự sinh vào `server/.dev-secrets.json`; prod thiếu thì server dừng | env.js:60-94 |
| `JWT_EXPIRES_IN` | `7d` | env.js:156 |
| `TEACHER_SECRET_KEY` | >=8 ký tự; dev tự sinh và in ra console; so sánh bằng sha256 + `timingSafeEqual` | env.js:97, authController.js:209 |
| `API_KEY_ENCRYPTION_SECRET` | tùy chọn, >=16 nếu có; thiếu thì lưu Gemini key dạng thô | env.js:105,186 |
| `BCRYPT_COST` / `BCRYPT_TEMP_COST` | 10 (4-15) / 8 (4-14) | env.js:136-146 |
| `CORS_ORIGIN` | `*` hoặc danh sách phẩy | env.js:107 |
| `TRUST_PROXY` | prod mặc định 1, dev false | env.js:125 |
| `HTTPS_PROXY`/`HTTP_PROXY` | `undici ProxyAgent` global cho gọi Gemini | config/proxy.js |
| `EXAM_CACHE_TTL_MS` | 20000; 0 = tắt cache | utils/examCache.js:6-15 |
| `TEMPLATE_TRASH_DAYS` | 30 (tối đa 3650) | models/ExamTemplate.js:56-63 |
| `DUPLICATE_RATE_MAX/WINDOW_MS` | 10 / 60000 | templateController.js:21-22 |
| `RATE_LIMIT_<TÊN>_MAX` | ghi đè từng bucket | rateLimit.js:66 |
| `ESSAY_UPLOAD_*`, `ESSAY_MEDIA_*`, `ESSAY_DOCX_*`, `ESSAY_EXTRACT_TIMEOUT_MS` | xem bảng 1.4 | config/essayUpload.js |

Khởi động (`index.js`): `assertValidConfig` -> `setupProxy` -> `connectDB` -> `seedRbac` -> `listen`; SIGTERM/SIGINT đóng server, ngắt DB, ép thoát sau 10s.

### 1.2 Middleware (thứ tự trong `app.js`)

1. `trust proxy` = env (app.js:14); CORS theo `corsOrigin` (17).
2. `helmet` với CSP: self + google fonts, `frame-ancestors none`, `upgradeInsecureRequests: null` (19-34).
3. `apiLimiter` trên `/api` đặt TRƯỚC body parser (35).
4. Body JSON theo tuyến: `/api/me/sittings/:id/submit` = 2mb; `POST /api/templates` và `PUT /api/(templates|sittings)/:id` = 5mb (parser gắn ở route SAU authenticate, app.js:50-56, routes/templateRoutes.js:45); còn lại 1mb. Cả urlencoded 1mb.
5. Routes: `/api/auth`, `/api/classes`, `/api/me`, `/api/me/sittings`, `/api/templates`, `/api/sittings`, `/api/essay-uploads`; `/api/health`; 404 JSON cho `/api/*` chưa có; còn lại phục vụ `client/dist` (SPA fallback) (app.js:66-107).
6. Error handlers: `bodyLimitErrorHandler` (413 `entity.too.large`), Multer error -> 400, SyntaxError JSON -> 400, còn lại 5xx trả thông điệp cố định (app.js:110-144).

### 1.3 Xác thực / phân quyền (`middlewares/authMiddleware.js`, `services/rbac.js`)

- `authenticate`: đọc `Authorization: Bearer`; verify JWT `{id, tv}`; nạp User; so `tv` với `user.tokenVersion` (khác -> 401 `UNAUTHENTICATED` "Phiên đã bị thu hồi"); nếu `mustChangePassword` chỉ cho `GET /api/auth/me`, `POST /api/auth/change-password`, `POST /api/auth/logout-all`, ngoài ra 403 `MUST_CHANGE_PASSWORD` (authMiddleware.js:10-86). Lỗi hạ tầng không phải JWT -> 500.
- `requirePermission(perm)`: kiểm quyền theo `req.user.role` (cache vai trò 60s trong RAM) -> 403 `FORBIDDEN` (95-107).
- `requireClassPermission(perm,{withDeleted,param})`: nạp lớp + `ClassMember` đã `approved` của user; không phải thành viên -> **404** `NOT_FOUND` (không lộ lớp tồn tại); thành viên thiếu quyền -> 403; gắn `req.classDoc`, `req.membership` (118-143). Quyền tính theo `memberRole` (teacher/student) chứ không theo `createdBy`.
- `requireApiKey`: user chưa có Gemini key -> 400 `{requireApiKey:true}` (162-174).
- Vai trò hệ thống: `teacher`, `student` (enum còn `admin`, chưa dùng). Danh mục quyền trong `services/rbac.js:7-28`; `seedRbac` chạy mỗi lần khởi động: `$addToSet` quyền mặc định, `$pull` quyền `exam:*` đã lỗi thời (49-57). Role lưu trong collection `roles` nên sửa được ở DB.
  - Student: `class:join/leave`, `enrollment:read`, `classmate:read`, `account:changePassword/logoutAll`, `sitting:take/listMine`, `result:readMine`.
  - Teacher: toàn bộ `class:*`, `invite:*`, `student:*`, `teacher:*`, `account:*` (+`updateApiKey`), `result:read`, `violation:delete`, `essay:grade/media`, `template:*`, `sitting:*`, `result:publish`, `sitting:take`, `result:readMine`.

### 1.4 Rate limit (`middlewares/rateLimit.js`) - `express-rate-limit`, header draft-7, trả 429 `RATE_LIMITED`

| Bucket | Giới hạn | Khóa | Ghi chú |
|---|---|---|---|
| API (chung /api) | 300/phút | IP | bỏ qua `/api/health` và các đường học sinh |
| LOGIN (giáo viên) | 10/15p | IP | |
| REGISTER (giáo viên) | 5/60p | IP | |
| TEACHER_UPLOAD (parse đề) | 10/10p | user | tốn quota Gemini |
| STUDENT_REGISTER | 300/60p | IP | hoàn lại khi 5xx |
| REGISTER_PHONE | 5/60p | sdt+IP | |
| STUDENT_LOGIN | 600/15p | IP | mọi lần |
| LOGIN_IP_FAIL | 150/15p | IP | chỉ tính lần sai (4xx) |
| LOGIN_ACCOUNT | 10/15p | sdt+IP | chỉ lần sai |
| LOGIN_PHONE_GLOBAL | 100/15p | sdt | chỉ lần sai |
| CHANGE_PASSWORD | 10/15p | user | chỉ lần sai |
| STUDENT_API | 3000/phút | IP | `/me`, `/change-password`, `/logout-all`, `/api/me/*` |
| CLASS_JOIN / _IP | 20/10p user, 600/10p IP | | |
| MEMBER_SEARCH / _DAY | 60/10p, 500/ngày | user | chống quét danh bạ |
| MEMBER_LOOKUP | 200/10p | user | |
| CSV_IMPORT | 10/10p | user | |
| RESET_PASSWORD | 100/10p | user | |
| SITTING_RESOLVE / _IP | 20/10p user, 300/10p IP | | chỉ lần sai |
| SITTING_START | 30/phút user, 400/phút IP | | |
| SITTING_SUBMIT | 10/phút user, 400/phút IP | | |
| RESULT_VIEW | 30/phút user, 400/phút IP | | |
| duplicate template | 10/phút | user | limiter RAM tự viết (`createWindowLimiter`) |

Upload tự luận có limiter riêng bằng RAM tự viết (không phải express-rate-limit): `ESSAY_UPLOAD_IP_RATE_MAX` 1200/phút/IP, `IP_BAD_RATE_MAX` 30 (token sai), `SESSION_RATE_MAX` 12/phút/phiên, semaphore đồng thời 3 (1-20), `RETRY_AFTER` 3s, body timeout 90s, 503 `busy`, 429 `rate_limited`. Trần kích thước: text 2MB, media 3MB (jpg/png/webp/pdf), kho media tổng 250MB, docx giải nén 10MB / xml 3MB / tỉ lệ nén 100 / 500 entry, extract timeout 10s, orphan TTL 24h, media TTL an toàn 30 ngày, giữ sau khi chấm 7 ngày (config/essayUpload.js:22-54).

### 1.5 Format response / lỗi (`utils/apiResponse.js`)

- Thành công: `{ success:true, data, message? }`. Phân trang: `data = { items, page, limit, total, totalPages }` (`parsePage` kẹp page<=100000, limit theo max từng route).
- Lỗi: `{ success:false, code, message, field? }` qua `fail(res,status,code,message,field)`; `field` chỉ gắn với lỗi nhập liệu đã biết để client tô ô.
- `wrap(fn)`: bắt `ValidationError`/`CastError` Mongoose -> 400 `VALIDATION_ERROR`; còn lại 500 `INTERNAL_ERROR` "Lỗi máy chủ, vui lòng thử lại sau." (không lộ stack).
- `toObjectId(raw)` chỉ nhận chuỗi hex 24 ký tự; sai -> null (controller trả 404/400).
- **Ngoại lệ không đồng nhất cần giữ để client cũ chạy:** (a) route upload tự luận trả `{success:false, status:'<mã_snake_case>', message}` (key `status` thay `code`; routes/essayUploadRoutes.js:28-31); (b) lỗi 409 chấm điểm có thêm `status:'conflict'` + `data`; (c) vài lỗi cũ của auth (`getMe`, `logoutAll`) không có `code`; (d) `requireApiKey` trả `requireApiKey:true`.

---

## 2. Mô hình dữ liệu (Mongoose, 11 model)

Plugin/chung: `models/plugins/softDelete.js` (thêm `deletedAt` + tự lọc `deletedAt:null` cho find/findOne/update*/count*/distinct/aggregate; bỏ lọc bằng option `withDeleted`; **lưu ý** `aggregate` chèn `$match` đầu pipeline; `$lookup` không bị lọc). Schema câu hỏi chung `models/schemas/questionSchema.js`. Mã hóa field: `utils/secureField.js`.

| Model (collection) | Field chính | Index | Quan hệ / ghi chú |
|---|---|---|---|
| **User** (`users`) User.js | `phoneNumber` (unique, trim), `fullName` (<=255, setter `toProperName`), `nameSearch` (không dấu, đặt ở pre-validate), `password` (hash bcrypt, min 6 trên schema nhưng app ép >=8), `mustChangePassword`, `geminiApiKey` (**setter mã hóa / getter giải mã**), `tokenVersion`, `role` (`teacher|student|admin`, immutable), `createdAt` | `{phoneNumber}` unique; `{role,nameSearch}` | toJSON ẩn `geminiApiKey,password,nameSearch,tokenVersion`; getters bật cả toObject. `comparePassword` qua `passwordHash`. |
| **Role** (`roles`) | `name` unique, `permissions[]` | name | seed lúc khởi động |
| **Class** (`classes`) Class.js | `createdBy` (chỉ ghi nhận), `name` (<=100, ép HOA vi), `code` (<=30, ép HOA vi), `codeKey`, `activeCodeKey`, `startYear`(2000-2100), `endYear`(2000-2112), span 1-12 năm, `status` (`active|graduated`), `invite.{student,teacher}.{token (select:false), enabled, rotatedAt}`, timestamps, `deletedAt` | unique partial `{activeCodeKey}` (chỉ tồn tại khi chưa xóa); unique sparse `invite.student.token`, `invite.teacher.token` | softDelete **override**: xóa thì `$unset activeCodeKey` để nhả mã; `restoreWithCode(id,{code})` dùng pipeline update + `$literal`, khôi phục có thể đổi mã (Class.js:33-46). Token mời là plaintext base64url 43 ký tự. |
| **ClassMember** (`classmembers`) | `classId`, `userId`, `memberRole` (`/^[a-z_]+$/`), `status` (`pending|approved`), `source` (`creator|invite|member_add|csv`), `addedBy`, `requestedAt`, `approvedAt`, `approvedBy` | unique `{classId,userId}`; `{classId,memberRole,status,requestedAt}`; `{userId,status}` | Nguồn sự thật cho quyền theo lớp. Join/thêm idempotent bắt E11000. |
| **ExamTemplate** (`examtemplates`) | `createdBy`, `title` (<=255), `titleKey` (chuẩn hóa), `activeTitleKey`, `purgeAt`, `description`(<=255), `totalQuestions`, `questions[QuestionSchema]`, `scoring{mcqMax,essayMax}`, timestamps, `deletedAt` | unique partial `{createdBy,activeTitleKey}`; **TTL** `{purgeAt}` expireAfterSeconds 0; `{createdBy,createdAt}`; `{createdBy,deletedAt,createdAt}` | Thùng rác 30 ngày: `softDeleteOwned` đặt `deletedAt`+`purgeAt`, `$unset activeTitleKey` (nhả tên); `restoreOwned` chỉ khi `purgeAt>now`. pre-save tính `totalQuestions`, `scoring`. |
| **ExamSitting** (`examsittings`) | `createdBy`, `templateId`, `templateTitle`, `title`(<=255, không unique ở DB, unique theo giáo viên ở controller), `description`, `totalQuestions`, `questions[]` (**bản sao** từ đề mẫu), `scoring`, `classIds[]` (>=1), `openAt`, `closeAt` (>openAt), `durationMinutes` (int>=1), `shuffleQuestions`, `antiCheat`, `code` (6 ký tự), `resultsPublishedAt` | unique `{code}`; `{createdBy,createdAt}`; `{createdBy,classIds}`; `{templateId}` | Không softDelete (xóa cứng khi chưa có bài nộp). Hook post save/update/delete/bulkWrite => `examCache.clear()` (ExamSitting.js:63-68). |
| **SittingGrant** | `sittingId`, `studentId`, `classIds[]` (snapshot lớp cấp quyền), `grantedBy`, `grantedAt` | unique `{sittingId,studentId}`; `{studentId,grantedAt}` | "Danh sách thí sinh được vào ca". |
| **SittingSession** | `sittingId`, `studentId`, `startedAt`, `deadlineAt`, `questionOrder[Number]`, `optionsOrder` (Map<string,[string]>), `uploadToken` (48 hex, chỉ khi ca có tự luận), `expiresAt` | unique `{sittingId,studentId}`; `{uploadToken}`; **TTL** `{expiresAt}` | = đồng hồ làm bài. `expiresAt = deadlineAt + 30 ngày`. Bị xóa sau khi nộp. |
| **SittingSubmission** | `sittingId`, `studentId`, `classIds[]` (snapshot), `answers` Map<string,string>, `score`,`mcqScore`,`essayScore`,`maxScore`, `essayAnswers[{questionId,text,source(text|file-text|file-media),fileName,fileMime,extractedChars,mediaRef}]`, `essayResults[{questionId,criteria[{key,score,comment}],total,feedback,gradedAt,source('teacher'),teacherOverride}]`, `gradingStatus` (`none|pending|done`), `essayStale`, `essayStaleAt`, `byTeacher`, `correctCount`, `totalQuestions`, `startedAt`, `timeSpentSeconds`, `isAutoSubmitted`, `questionOrder`, `optionsOrder`, `tabViolations[{at,reason}]`, `submittedAt` | unique `{sittingId,studentId}`; `{studentId,submittedAt}`; `{sittingId,classIds}`; `{essayAnswers.mediaRef}` | `byTeacher` = giáo viên tự thi thử ca của mình, bị loại khỏi thống kê/lock/xuất. Lưu cả `questionOrder`/`optionsOrder` để chấm & hiển thị lại đúng thứ tự. |
| **EssayMedia** | `data` Buffer, `mime`, `size`, `fileName`, `sittingId`, `questionId`, `submissionId`, `attached`, `createdAt`, `expiresAt` | **TTL** `{expiresAt}`; `{submissionId,questionId}`; `{attached,createdAt,sittingId,questionId,_id}` | Ảnh/PDF lưu **trong Mongo** (Buffer). |
| **EssayUpload** | `uploadId` (32 hex unique), `sittingId`, `studentId`, `sessionId`, `questionId`, `kind` (`text|media`), `text`, `fileName`, `mime`, `extractedChars`, `mediaId`, `mediaSize`, `submissionId`, `createdAt`, `expiresAt` | unique `{uploadId}`; unique `{sessionId,questionId}` (nộp đè); TTL `{expiresAt}`; `{submissionId,questionId}`; `{kind}` | Bản nháp tải lên trước khi nộp bài. |

`QuestionSchema` (`_id:false`): `id` (Number>=1, ổn định, khóa chấm), `questionText`, `context`, `type` (`mcq|essay`, mặc định mcq), `requirements`, `rubric[{key,label,max>=0}]`, `maxScore`, `options{A,B,C,D}` (A,B bắt buộc nếu mcq), `correctAnswer` (A-D, hoa), `explanation`.

Thư mục `scripts/` (người dùng tự chạy, không tự chạy khi khởi động): `legacyCollections.js` (drop `exams`, `examsessions`, `submissions` cũ nếu rỗng), `templateIndexes.js`, `classCodes.js` (di chuyển index unique cũ sang partial), `seedAll.js`, `clearSeed.js`, `generate-secrets.js`. Dự án mới nếu bắt đầu DB sạch thì không cần các script di chuyển, nhưng **phải tạo đúng index partial/TTL từ đầu**.

---

## 3. Bảng endpoint đầy đủ

Quy ước: "Auth" = `authenticate`; quyền RBAC là mã trong `services/rbac.js`; `[class:X]` = `requireClassPermission(X)` (404 nếu không phải thành viên đã duyệt). Mọi response thành công dạng `{success:true,data}` trừ khi ghi khác.

### 3.1 Hệ thống & Auth (`/api/...`)

| Method | Path | Quyền / limiter | Body / query | Response & quy tắc | Mã lỗi |
|---|---|---|---|---|---|
| GET | `/api/health` | công khai | | `{status:'OK',timestamp,service}` (không bọc success) | |
| POST | `/api/auth/teacher/register` | LOGIN-class `registerLimiter` (5/60p IP) | `phoneNumber,fullName,password,secretKey,geminiApiKey?` | 201 `{token,user}`; sdt `^0\d{9,10}$`; tên 2-255 ký tự Unicode letter; mật khẩu >=8 ký tự, <=72 byte; secretKey sai không được tạo | 400 `VALIDATION_ERROR`(+field), 403 `SECRET_KEY_INVALID`, 409 `PHONE_TAKEN`, 503 `SERVER_BUSY` |
| POST | `/api/auth/teacher/login` | `loginLimiter` | `phoneNumber,password` | 200 `{token,user}`; role phải khớp, chạy `compareDummy` khi không có user (chống dò sdt bằng thời gian) | 400, 401 `INVALID_CREDENTIALS`, 503 |
| POST | `/api/auth/student/register` | `studentRegisterLimiter`,`registerPhoneLimiter` | như trên, không `secretKey`; trường bẫy `website` (có giá trị -> 400) | 201 `{token,user}` | như trên |
| POST | `/api/auth/student/login` | 4 limiter (xem 1.4) | `phoneNumber,password` | 200 | 401 `INVALID_CREDENTIALS` |
| GET | `/api/auth/me` | `studentApiLimiter`, Auth (cho qua cả khi mustChangePassword) | | `{id,phoneNumber,fullName,role,mustChangePassword,createdAt, hasApiKey,apiKeyLast4 (chỉ teacher)}` | 401 |
| PUT | `/api/auth/api-key` | Auth + `account:updateApiKey` | `geminiApiKey` (rỗng = xóa) | `{hasApiKey,apiKeyLast4}`; lưu mã hóa | 401,403 |
| POST | `/api/auth/logout-all` | Auth + `account:logoutAll` | | `tokenVersion++` => mọi JWT cũ vô hiệu | |
| POST | `/api/auth/change-password` | Auth + `account:changePassword` + `changePasswordLimiter` (chỉ lần sai) | `currentPassword,newPassword` | 200 trả **token mới** (`tokenVersion++`, `mustChangePassword=false`); mật khẩu mới phải khác cũ | 400 `VALIDATION_ERROR` |

`user` trả ra: `{id,phoneNumber,fullName,role,mustChangePassword, hasApiKey?, apiKeyLast4?}`; **không bao giờ** trả key thô.

### 3.2 Lớp học (`/api/classes`, `/api/me`)

| Method | Path | Quyền | Body / query | Response & nghiệp vụ | Mã lỗi |
|---|---|---|---|---|---|
| POST | `/api/classes/join` | Auth + `class:join` (+3 limiter) | `{token}` (43 ký tự `[A-Za-z0-9_-]`) | Tạo ClassMember `pending` (idempotent, giữ `approved`); token phải khớp `invite.<role của user>`, `enabled`, lớp `active`. Trả dto lớp + `membershipStatus` | 404 `INVITE_INVALID` (mọi lý do sai đều cùng mã) |
| POST | `/api/classes` | `class:create` | `name,code,startYear,endYear` | 201 dto + `studentCount:0,teacherCount:1`; tự thêm creator làm teacher `approved` (`source:creator`); lỗi thì rollback lớp | 400, 409 `CLASS_CODE_TAKEN`(field code) |
| GET | `/api/classes` | `class:list` | `view=active|graduated|deleted|all`, `q`(<=50), `page`,`limit<=50` (mặc định 10) | Chỉ lớp mình là giáo viên (approved; pending chỉ thấy khi chưa xóa); sắp xếp năm bắt đầu/kết thúc giảm dần, rank, tên; kèm đếm học sinh/giáo viên | 400 |
| GET | `/api/classes/:id` | `[class:read]` | | dto + đếm (cả pending) + danh sách giáo viên | 404 |
| PATCH | `/api/classes/:id` | `[class:update]` | một trong `name,code,startYear,endYear,status` | lưu qua `save()` để validate/ép HOA; | 400, 409 |
| DELETE | `/api/classes/:id` | `[class:delete]` | | xóa mềm, nhả mã | |
| POST | `/api/classes/:id/restore` | `[class:restore, withDeleted]` | `{code?}` (1-30) | khôi phục, có thể đổi mã | 409 `CLASS_CODE_TAKEN` |
| GET | `/api/classes/:id/invite` | `[invite:read]` | | `{student:{token,enabled,rotatedAt}, teacher:{...}}`; `Cache-Control:no-store` | |
| POST | `/api/classes/:id/invite/:kind/rotate` | `[invite:manage]` | `kind=student|teacher` | token mới | 400 |
| PATCH | `/api/classes/:id/invite/:kind` | `[invite:manage]` | `{enabled:boolean}` | | 400 |
| GET | `/api/classes/:id/students` | `[student:read]` | `status=pending|approved`, `q`(tên không dấu), `studentId`, `page`,`limit<=100` (50) | aggregate `$lookup` User, sắp xếp `nameSearch` | 400 |
| GET | `/api/classes/:id/student-search` | `[student:add]`+`memberSearchLimiter`+`DayLimiter` | `q` (tên >=3 ký tự, hoặc sdt >=3 chữ số), `page`,`limit<=50` | tìm học sinh toàn hệ thống kèm `alreadyMember`, `hasMore` | 400 |
| POST | `/api/classes/:id/students` | `[student:add]`+`memberLookupLimiter` | `{studentId}` hoặc `{phoneNumber}` | 201; nếu đang pending thì duyệt luôn; lớp phải `active` | 404 `STUDENT_NOT_FOUND`, 409 `CLASS_NOT_ACCEPTING` |
| POST | `/api/classes/:id/students/approve-all` | `[student:approve]` | | `{approved:n}` | 409 `CLASS_NOT_ACCEPTING` |
| POST | `/api/classes/:id/students/reject-all` | `[student:remove]` | | `{rejected:n}` (xóa pending) | |
| POST | `/api/classes/:id/students/:userId/approve` | `[student:approve]` | | idempotent | 404 |
| DELETE | `/api/classes/:id/students/:userId` | `[student:remove]` | | xóa ClassMember | 404 |
| PATCH | `/api/classes/:id/students/:userId` | `[student:update]` | `{fullName}` | chỉ HS đã approved của lớp; `save()` để cập nhật `nameSearch` | 400, 404 `STUDENT_NOT_FOUND` |
| POST | `/api/classes/:id/students/:userId/reset-password` | `[student:resetPassword]`+`resetPasswordLimiter` | | đặt mật khẩu tạm 10 ký tự (alphabet bỏ I,O,0,1), `mustChangePassword=true`, `tokenVersion++`; trả `temporaryPassword` một lần; `no-store` | 503 `SERVER_BUSY` |
| POST | `/api/classes/:id/import` | `[student:import]`+`csvImportLimiter` | multipart `file` (.csv<=256KB hoặc .xlsx<=1MB), cột: họ tên, sdt (có/không dòng tiêu đề) | tối đa 200 dòng; tạo HS mới với mật khẩu tạm + `mustChangePassword`; HS sdt đã có thì chỉ thêm vào lớp; trả `{summary{total,created,added,alreadyMember,errors}, results[{row,status,fullName,phoneNumber,temporaryPassword?,message?}]}` | 413 `PAYLOAD_TOO_LARGE`, 422 `CSV_INVALID`/`CSV_TOO_MANY_ROWS`, 409 `CLASS_NOT_ACCEPTING`, 503 |
| GET | `/api/classes/:id/teachers` | `[teacher:read]` | `status?` | không phân trang | |
| GET | `/api/classes/:id/teacher-search` | `[teacher:add]` + limiter | như student-search | | |
| POST | `/api/classes/:id/teachers` | `[teacher:add]` | `{teacherId}` hoặc `{phoneNumber}` | 201 | 404 `TEACHER_NOT_FOUND`, 409 |
| POST | `/api/classes/:id/teachers/:userId/approve` | `[teacher:approve]` | | | 404 |
| DELETE | `/api/classes/:id/teachers/:userId` | `[teacher:remove]` | | không tự gỡ mình (400); **không gỡ được giáo viên cuối cùng** | 400, 409 `LAST_TEACHER` |
| GET | `/api/me/classes` | `enrollment:read` | | lớp của học sinh + `membershipStatus` | |
| GET | `/api/me/classes/:classId` | `[classmate:read]` | | dto + `teachers[]`,`classmates[]` (chỉ tên) | 404 |
| DELETE | `/api/me/classes/:classId` | `class:leave` | | rời/hủy yêu cầu; giáo viên cuối cùng không rời được | 409 `LAST_TEACHER` |

`guardedDeleteMember` (services/classMembers.js:39-52) chống race "giáo viên cuối cùng": xóa, kiểm lại, nếu còn 0 thì chèn lại bản chụp.

### 3.3 Đề mẫu (`/api/templates`) - mọi route Auth, chỉ chủ sở hữu (`createdBy`), sai chủ -> 404

| Method | Path | Quyền | Body / query | Response & nghiệp vụ | Mã lỗi |
|---|---|---|---|---|---|
| POST | `/parse` | `template:parse` + `teacherUploadLimiter` + `requireApiKey` | multipart `file` (.pdf/.doc/.docx/.txt, <=20MB, 1 file, **memoryStorage**) | Trích text -> Gemini; trả `{questions[],totalQuestions,skippedQuestions,needsReviewQuestions,model,...}`; **không lưu DB** | 400 (thiếu file/không đọc được/không có câu), 400 `requireApiKey`, 429 quota, 5xx |
| POST | `/` | `template:create` + JSON 5mb | `title,description?,questions[]` | 201 summary; validate bằng `sanitizeQuestions` | 400 `VALIDATION_ERROR`, 409 `TEMPLATE_TITLE_TAKEN` (field title; phân biệt trùng với đề đang dùng vs đề trong thùng rác) |
| GET | `/` | `template:list` | `view=active|deleted`, `q`, `page`,`limit<=100` (20) | summary (không `questions`) + `sittingCount`; view deleted kèm `deletedAt,purgeAt,daysLeft` | 400 |
| GET | `/:id` | `template:read` | | detail gồm `questions` | 404 |
| PUT | `/:id` | `template:update` + JSON 5mb | `title?,description?,questions?` | sửa đề mẫu **không** ảnh hưởng ca đã tạo | 400, 404, 409 |
| DELETE | `/:id` | `template:delete` | | xóa mềm 30 ngày; `{sittingCount,deletedAt,purgeAt}` | 404 |
| POST | `/:id/duplicate` | `template:duplicate` (limiter 10/phút) | | tạo "Tên (bản sao)" / "(bản sao N)", tối đa 20 lần thử khi đụng tên | 429, 409 |
| POST | `/:id/restore` | `template:restore` | `{title?}` | chỉ khi còn hạn `purgeAt`; có thể đổi tên | 404, 409 `TEMPLATE_TITLE_TAKEN` |
| DELETE | `/:id/purge` | `template:purge` | | xóa cứng, chỉ khi đã nằm trong thùng rác | 409 `TEMPLATE_NOT_IN_TRASH` |

### 3.4 Ca thi - phía giáo viên (`/api/sittings`) - Auth, chủ sở hữu `createdBy`

| Method | Path | Quyền | Body / query | Response & nghiệp vụ | Mã lỗi |
|---|---|---|---|---|---|
| GET | `/candidates` | `sitting:create` | `classIds` (csv), `q`, `page`,`limit<=50` | học sinh đã duyệt của các lớp (lớp phải `active` và mình là giáo viên) | 400 `INVALID_CLASSES` |
| POST | `/` | `sitting:create` | `templateId,title?,description?,openAt,closeAt,durationMinutes,shuffleQuestions?,antiCheat?,classIds[],allInClasses?+excludeStudentIds? | studentIds[]` | 201 `{id,code,link:'/ca/<code>'}`; **sao chép** câu hỏi từ đề mẫu; tạo `SittingGrant` cho thí sinh chọn; sinh mã 6 ký tự (thử lại tối đa 5 lần khi trùng) | 400, 404, 409 `SITTING_TITLE_TAKEN`, 409 `SITTING_OVERLAP`, 400 `INVALID_STUDENTS`, 503 `CODE_GENERATION_FAILED` |
| GET | `/` | `sitting:list` | `classId`, `status=not_started|open|ended`, `page`,`limit<=100`(20) | summary + `grantedCount`,`submittedCount`,`status`,`link` | 400 |
| GET | `/:id` | `sitting:read` | | detail có `questions`, `locked`,`lockReason (HAS_SUBMISSIONS|ACTIVE_SESSIONS)`,`activeSessionCount`,`ungrantedInClassCount`,`templateStatus (active|deleted|purged)`,`classes[]` | 404 |
| PUT | `/:id` | `sitting:update` + JSON 5mb | `title,description,openAt,closeAt,durationMinutes,shuffleQuestions,antiCheat,questions` | xem 4.3 (khóa sửa câu hỏi, chấm lại, tính lại deadline) | 400, 409 `SITTING_LOCKED`, `RESULTS_PUBLISHED`, `SITTING_OVERLAP`, `SITTING_TITLE_TAKEN` |
| POST | `/:id/regenerate-code` | `sitting:update` | | `{code,link}` | 503 |
| PUT | `/:id/classes` | `sitting:update` | `{classIds[]}` | thêm lớp kiểm overlap; tự dọn grant/session của HS không còn lớp nào (trừ HS đã nộp); optimistic lock theo `classIds` | 409 `SITTING_CLASSES_CHANGED` |
| DELETE | `/:id` | `sitting:delete` | | xóa cứng ca + grant + session + essayUpload + essayMedia; **chặn nếu có bài nộp** (không tính `byTeacher`) | 409 `SITTING_HAS_SUBMISSIONS` |
| GET | `/:id/grants` | `sitting:grant` | `q`,`page`,`limit<=100`(50) | `{studentId,fullName,classIds,classNames,submitted,hasSession,inClass}` | |
| POST | `/:id/grants` | `sitting:grant` | `allInClasses/excludeStudentIds` hoặc `studentIds` | upsert bulk; `{granted,alreadyGranted}` | 400 `INVALID_STUDENTS` |
| POST | `/:id/grants/revoke` | `sitting:grant` | `{studentIds[]}` | xóa grant + session dở (không đụng người đã nộp); `{revoked,removedSessions,skippedSubmitted}` | 400 |
| GET | `/:id/results` | `result:read` | `classId|all`, `classQ`, `includeTeacher`, `sort=stt|name|correct|wrong`, `dir`, `status=pending|done|stale|cheat|auto|none|not_submitted`, `search`, `page`,`limit<=100`(50), `notSubmittedPage/Limit` | `{exam,classes,stats{totalSubmissions,gradedSubmissions,avgScore,maxScore,minScore},submissions[...],pagination,notSubmitted[],notSubmittedPagination}`; tên lấy **hiện tại** từ User | 400 |
| GET | `/:id/results/export` | `result:read` | `classId` | JSON `{exam,submissions,notSubmitted}` cho client tự dựng CSV | 400 |
| GET | `/:id/results/export.xlsx` | `result:read` | `classId` | file xlsx (`Content-Type` xlsx, `Content-Disposition` UTF-8, `no-store`), tối đa 5000 dòng | 413 `EXPORT_TOO_LARGE` |
| GET | `/:id/grading-progress` | `result:read` | | `{scoring,essaySubmissions,finished,pendingManualCount,submissions{status:count},staleCount}` | |
| PUT | `/:id/submissions/:submissionId/essay/:questionId` | `essay:grade` | `{criteria:[{key,score?,comment?}],feedback?,baseGradedAt?}` | chấm tay một câu; xem 4.5 | 400, 404, 409 `GRADE_CONFLICT`, 503 `BUSY` |
| GET | `/:id/submissions/:submissionId/essay/:questionId/media` | `essay:media` | | stream ảnh/PDF gốc (inline, CSP sandbox, nosniff, no-store) | 404, 410 `MEDIA_GONE` |
| DELETE | `/:id/submissions/:submissionId/violations/:index` | `violation:delete` | `?at=<ISO>` (khóa lạc quan) | xóa một log vi phạm bằng pipeline update | 400, 409 `VIOLATION_CHANGED` |
| GET | `/:id/publication` | `result:read` | | `{publishedAt,gateAt,ended,submittedCount,readyCount,ungradedCount,staleCount,notSubmittedCount,hiddenCount,canPublish,reasons,leak{otherOpenSittings,items}}` | |
| POST | `/:id/results/publish` | `result:publish` | | idempotent; chặn nếu còn bài tự luận chưa chấm; ghi nguyên tử `resultsPublishedAt` | 409 `GRADING_INCOMPLETE` (kèm `data.ungradedCount,staleCount`) |
| POST | `/:id/results/unpublish` | `result:publish` | | đặt `resultsPublishedAt=null` | |

### 3.5 Ca thi - phía học sinh (`/api/me/sittings`, `studentApiLimiter` đứng đầu)

| Method | Path | Quyền / limiter | Body | Response & nghiệp vụ | Mã lỗi |
|---|---|---|---|---|---|
| GET | `/` | `sitting:listMine` | `page`,`limit<=100`(20) | ca đã được cấp quyền và còn thuộc lớp; `myState`; kèm `result{score,maxScore}` nếu đã công bố | |
| POST | `/resolve` | `sitting:take` + resolve limiter (chỉ lần sai) | `{code}` (<=32 ký tự -> bỏ khoảng trắng, HOA, `^[A-Z0-9]{6}$`) | thông tin ca + `serverTime`; chỉ người có grant (hoặc đã nộp) | 400 `INVALID_CODE`, 404 `SITTING_NOT_FOUND`, 403 `NOT_GRANTED` |
| GET | `/:sittingId` | `sitting:take` | | như resolve | 404, 403 |
| POST | `/:sittingId/start` | `sitting:take` + start limiters | | idempotent; tạo/trả phiên + câu hỏi **đã ẩn đáp án**; xem 4.1 | 403 `NOT_GRANTED`/`SITTING_NOT_STARTED`/`SITTING_ENDED`/`TIME_UP`, 409 `ALREADY_SUBMITTED` |
| GET | `/:sittingId/session` | `sitting:take` | | `{deadlineAt,remainingSeconds,serverTime}` (để đồng bộ đồng hồ) | 403 `NO_SESSION`, 409 |
| POST | `/:sittingId/submit` | `sitting:take` + submit limiters, JSON 2mb | `{answers:{id:'A'..},essayAnswers:{id: string | {text?,uploadId?}},isAutoSubmit?,tabViolations?[{at,reason}]}` | 201 `{submittedAt,warnings?}`; chấm trắc nghiệm ở server; xem 4.1 | 403 `TIME_UP`/`NO_SESSION`/`NOT_GRANTED`, 400 `INVALID_UPLOAD`, 409 `ALREADY_SUBMITTED` |
| GET | `/:sittingId/result` | `result:readMine`, `no-store` + result limiters | | kết quả chi tiết, kèm đáp án đúng + lời giải **chỉ khi đã công bố** | 404 `NO_SUBMISSION`, 403 `RESULTS_NOT_PUBLISHED`, 409 `RESULT_UPDATING` |
| GET | `/:sittingId/result/essay/:questionId/media` | như trên | | ảnh/PDF của chính mình | 404, 410 |

### 3.6 Upload tự luận

| Method | Path | Xác thực | Body | Response | Mã lỗi (key `status`) |
|---|---|---|---|---|---|
| POST | `/api/essay-uploads?questionId=<id>` | **không dùng `authenticate`**: header `X-Upload-Token` (48 hex = `SittingSession.uploadToken`) + `Authorization: Bearer` JWT phải khớp `session.studentId` | multipart `file` (1 file, field "file") `.txt/.docx/.jpg/.png/.webp/.pdf` | 201 `{uploadId,questionId,kind,fileName,mime,(size|extractedChars)}`; nộp đè cùng (phiên, câu) thay thế bản cũ | 401 `no_session`/`unauthenticated`, 403 `session_invalid`/`wrong_student`, 400 `invalid_question`/`no_file`/`too_many_files`/`bad_upload`, 413 `too_large`, 415 `heic_not_supported`/`content_mismatch`/`unsupported_type`/`docx_too_complex`/`text_encoding`, 422 `empty_text`/`docx_unreadable`/`extract_timeout`/`media_storage_full`, 408 `body_timeout`, 429 `rate_limited`, 503 `busy` |

---

## 4. Quy tắc nghiệp vụ không hiển nhiên

### 4.1 Đồng hồ làm bài, ẩn đáp án, nộp bài
- Đồng hồ ở server: `POST start` tạo `SittingSession` bằng `findOneAndUpdate(..., {$setOnInsert}, {upsert:true})` (an toàn đồng thời, bắt E11000). `deadlineAt = min(now + durationMinutes, closeAt)` (meSittingController.js:284-285). Gọi lại `start` (F5) trả lại **cùng phiên** và `remainingSeconds` tính từ `deadlineAt`; chỉ tạo phiên mới khi ca đang `open`, nhưng phiên sẵn có vẫn vào lại được sau `closeAt` đến `deadlineAt`. Quá `deadlineAt` -> 403 `TIME_UP` ở `start`.
- Nộp: ân hạn `SUBMIT_GRACE_MS = 120s` sau `deadlineAt` (meSittingController.js:26,365). Quá ân hạn -> 403 `TIME_UP`, bài không ghi. `timeSpentSeconds = now - startedAt`.
- Nộp trùng: unique `{sittingId,studentId}` + 409 `ALREADY_SUBMITTED`; sau khi nộp xong phiên bị xóa bất đồng bộ (`cleanupSessionAfterResponse`, có `settlePendingSessionCleanups` cho test) nên nộp lại vẫn 409 chứ không phải `NO_SESSION`.
- Ẩn đáp án: `toStudentQuestion` (meSittingController.js:97-110) chỉ trả `id,context,questionText,options,maxScore` (mcq) hoặc `id,type,context,questionText,requirements,maxScore` (tự luận). **Không có** `correctAnswer`, `explanation`, `rubric`. Đáp án chỉ ra ở `GET .../result` sau khi công bố (studentResult.js).
- Điểm mỗi câu trắc nghiệm hiển thị = `mcqMax / số câu mcq` (làm tròn 2 số).
- Đảo đề: `generateShuffledQuestionOrder` gom câu theo khối cùng `context` (bài đọc hiểu), đảo trong khối rồi đảo khối; `generateShuffledOptionsOrder` KHÔNG đảo câu có tham chiếu chéo ("A và B", "all of the above", "tất cả các đáp án"...) bằng regex (utils/examShuffle.js:108-122). Thứ tự lưu trong phiên và snapshot vào bài nộp; chấm bằng `mapByOptionsOrder` (ánh xạ khóa hiển thị về khóa gốc).
- Giáo viên chủ ca được thi thử ca của mình (`checkAccess` -> `byCreator`), bài đánh dấu `byTeacher` và bị loại khỏi thống kê, khóa, xuất, công bố.
- `tabViolations` do client gửi, server chỉ làm sạch (tối đa 200 mục, lý do <=200 ký tự).
- Quyền vào ca: cần **cả** `SittingGrant` **và** là học sinh `approved` của ít nhất một lớp còn sống gắn với ca (meSittingController.js:49-65). `classIds` trong bài nộp = snapshot giao giữa grant và lớp hiện hành.

### 4.2 Điểm số (`utils/examValidation.js`)
- Tổng điểm bài thi = 10. Không có tự luận: `mcqMax=10`. Có tự luận: `essayMax = Σ maxScore`, `mcqMax = max(0, 10 - essayMax)`; nếu có mcq thì `essayMax < 10`, toàn tự luận thì `<= 10` (validate ở `sanitizeQuestions`).
- Trắc nghiệm: `score = round2(đúng/tổng_mcq * mcqMax)`.
- Tự luận: rubric mặc định 5 tiêu chí x 0.5 nếu giáo viên không gửi rubric; mỗi tiêu chí `max` là bội số 0.25; `maxScore` = tổng rubric (nếu client gửi `maxScore` lệch thì lỗi); tối đa 20 tiêu chí, tối đa 15000 ký tự bài làm.
- `sanitizeQuestions`: yêu cầu >=1 câu, `id` nguyên dương **duy nhất** (id ổn định, là khóa chấm), mcq cần A,B không rỗng + đáp án đúng trỏ vào phương án có nội dung; cờ `needsReview` từ AI chỉ chặn lưu khi câu vẫn lỗi. Trả lỗi dạng mảng chuỗi tiếng Việt "Câu N: ...".

### 4.3 Sửa ca thi, khóa, chấm lại (`updateSitting`, `services/regrade.js`)
- Khóa chỉ áp dụng khi ca **đang mở** và (đã có bài nộp không-`byTeacher` hoặc có phiên còn hạn+ân hạn) -> sửa `questions` bị 409 `SITTING_LOCKED` (kiểm cả trước và sau khi đổi giờ).
- Nếu đã công bố kết quả và đổi `closeAt` làm ca mở lại -> 409 `RESULTS_PUBLISHED` (ghi có điều kiện `resultsPublishedAt:null`).
- Sửa `questions` (kể cả đổi đáp án) hoặc lịch -> `regradeSittingSubmissions` duyệt cursor **toàn bộ bài nộp**: chấm lại mcq theo `optionsOrder` đã lưu, tính lại `essayScore` từ `essayResults` (kẹp theo `maxScore` mới), `score = min(mcq + essay, total)`. Nếu "chữ ký tự luận" (`essaySignature`: id, đề, yêu cầu, maxScore, rubric) đổi -> đặt `essayStale=true`, `essayStaleAt=now` (học sinh thấy "đang cập nhật điểm", không công bố được cho tới khi chấm lại). Trả `updatedSubmissionsCount`.
- Đổi `closeAt`/`durationMinutes` -> `updateMany` pipeline trên **mọi phiên**: `deadlineAt = min(startedAt+duration, closeAt)`, `expiresAt = deadline + 30 ngày`; trả `affectedSessions` (số phiên bị rút ngắn).
- Điều kiện giờ: đóng ca phải ở tương lai khi tạo; `durationMinutes` nguyên >=1 và không làm `Date` tràn (`MAX_DATE_MS`).

### 4.4 Trùng ca thi (`sittingOverlap`) và mã ca
- Luật mới: hai ca của **cùng một lớp** không được **mở cùng phút** (`minuteWindow(openAt)` = [phút, phút+1)); chỉ tính ca có `closeAt > now - 120s`; quét mọi giáo viên (lớp dùng chung); lỗi chỉ lộ mã lớp, không lộ tên ca/giáo viên (sittingController.js:88-114, utils/sittingOverlap.js). Kiểm-rồi-ghi **không nguyên tử** (đã ghi `shortcut:` trong nguồn).
- Mã ca: 6 ký tự từ `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (`crypto.randomInt`), unique index, thử lại tối đa 5 lần khi E11000 `code_1`; chuẩn hóa nhập: bỏ khoảng trắng, HOA. Link = `/ca/<code>`.
- Tên ca duy nhất theo giáo viên (so khớp `trim + gộp khoảng trắng + lowercase vi`), kiểm ở controller bằng cách quét toàn bộ tên (không index).

### 4.5 Chấm tay tự luận, trạng thái, công bố
- Chấm một câu = ghi đè `essayResults[questionId]` với `criteria` theo rubric; mỗi điểm tiêu chí là bội số 0.25 trong [0,max], tổng <= `maxScore + 1e-9`; nhận xét làm sạch `<>` và cắt (comment 400, feedback 1500 ký tự).
- Khóa lạc quan tùy chọn: `baseGradedAt` (null = "chưa chấm", ISO = mốc cũ); lệch -> 409 `GRADE_CONFLICT` kèm dữ liệu mới. Ghi bằng `$elemMatch`/`$push` có điều kiện (`manualGradingStore.upsertEssayResult`, thử lại một lần khi không có khóa); sau đó `recomputeScores` (pipeline update `$sum`/`$round`/`$min maxScore`) và `refreshSubmissionStatus` (`pending` -> `done` khi chấm đủ mọi câu tự luận). Sau chấm xong tự gỡ `essayStale` nếu mọi câu có `gradedAt >= essayStaleAt`. Câu có media -> `scheduleMediaRetention` gia hạn giữ ảnh 7 ngày.
- `classifySubmission`: bài "ready" khi mọi câu tự luận có kết quả với đúng tập `key` rubric hiện hành và `total <= maxScore`; ngược lại "ungraded".
- Công bố: không còn cổng thời gian (có thể công bố khi ca đang mở); chặn khi còn bài `ungraded`; `publishAtomic` = `updateOne({resultsPublishedAt:null})`. Học sinh xem kết quả khi `resultsPublishedAt != null` **và** bài của mình `ready` (không thì 409 `RESULT_UPDATING`). Cảnh báo "leak" nếu còn ca khác dùng cùng đề mẫu chưa đóng (tối đa 5 ca).
- `computeResultScores` tính lại điểm từ dữ liệu thô khi hiển thị cho học sinh (không tin cột `score` lưu).

### 4.6 Upload tự luận (chi tiết)
- Token phiên (48 hex) sinh lúc `start` nếu ca có tự luận; server nhớ token "đã biết tốt" trong RAM (Map, 10 phút, tối đa 5000) để giảm truy vấn DB và để người đã xác thực không bị chặn bởi limiter token sai theo IP.
- Phân loại file bằng **magic bytes**, không tin MIME: jpg/png/webp/pdf -> `media` (lưu Buffer vào `EssayMedia`); `.txt` (UTF-8 nghiêm ngặt, cấm byte NUL) và `.docx` (kiểm zip: có `word/document.xml`, giới hạn entry/giải nén/tỉ lệ nén; trích text bằng `mammoth.extractRawText` có timeout) -> `text`; HEIC bị từ chối rõ ràng.
- Kho media có bộ đếm RAM (`mediaUsage.bytes`) + aggregate khi cần để áp trần 250MB toàn hệ thống.
- Khi nộp bài: `resolveEssayAnswers` đối chiếu `uploadId` thuộc đúng (ca, học sinh, câu, chưa gắn) -> file thay thế text; `upload_lost` chỉ cảnh báo. Sau khi lưu bài: `attachUploadsToSubmission` đổi TTL media sang `createdAt + 30 ngày`, upload text bị xóa; lỗi gắn chỉ log (không làm hỏng nộp bài) và có `healMediaAttachment`/`sweepUnattachedMedia` để sửa (chưa được lên lịch ở đâu).

### 4.7 Cache đề (`utils/examCache.js`, `services/sittingLookup.js`)
- Cache RAM tiến trình: tối đa 200 khóa, TTL 20s, khóa theo `_id` và `code:<MÃ>`; giá trị `deepFreeze`; không cache "không tìm thấy"; chống ghi bản cũ bằng bộ đếm `generation` (clear() xen giữa thì không lưu). Mọi thay đổi `ExamSitting` (hook mongoose) gọi `clear()`. **Chỉ đúng với 1 instance**; trên serverless/nhiều instance TTL 20s là độ trễ tối đa chấp nhận được.
- Trạng thái ca (`getSittingAvailability`): `not_started` (`now<openAt`), `open`, `ended` (`now>=closeAt`).

### 4.8 Xuất xlsx / csv
- XLSX: `write-excel-file` (ESM, nạp bằng `import()` động) tạo bố cục 4 dòng banner + 2 dòng tiêu đề gộp ô; cột động theo từng tiêu chí rubric; thêm dòng học sinh chưa nộp ("Chưa vào" / "Đã vào chưa nộp" / "Không còn trong lớp"); ô bắt đầu bằng `= + - @` hoặc tab/CR được tiền tố `'` chống CSV/formula injection (resultsXlsx.js:11-18); `Content-Disposition` có `filename` ASCII + `filename*` UTF-8; tối đa 5000 dòng.
- CSV: **server không sinh CSV** của kết quả; `GET .../results/export` trả JSON để client dựng CSV. Import CSV/XLSX học sinh thì server tự parse (`utils/csvParse.js` tự viết: BOM, `;` hoặc `,`, ngoặc kép; `utils/xlsxParse.js`: chống zip bomb tự kiểm EOCD/CDIR, `read-excel-file`, số nguyên 9-10 chữ số tự thêm `0` đầu).
- Giờ hiển thị cố định UTC+7 (`utils/dateFormat.js`), định dạng `hh:mm:ss dd/mm/yyyy`.

### 4.9 Mật khẩu, JWT, mã hóa, thùng rác, tìm kiếm
- Mật khẩu: bcrypt (native `bcrypt`, fallback `bcryptjs`), cost 10; **cổng đồng thời** `createGate` (4 song song, hàng đợi 300, đầy -> 503 `SERVER_BUSY` + `Retry-After:5`); import CSV có cổng riêng 2 song song/400 hàng chờ và cost tạm 8; `compareDummy` chống timing; `checkNewPassword`: >=8 ký tự (đếm code point), <=72 byte UTF-8.
- JWT: HS256 mặc định `{id, tv}`, hạn 7d; thu hồi hàng loạt bằng `tokenVersion` (đổi mật khẩu, reset mật khẩu, logout-all). Không có refresh token, không có cookie (Bearer trong header; client giữ trong storage).
- Mã hóa Gemini key: `enc:v1:<iv>:<tag>:<ct>` AES-256-GCM, khóa = `scrypt(secret, 'doc-to-exam-ai', 32)`; không có secret thì lưu thô; secret đổi thì giải mã trả rỗng + cảnh báo (key "mất").
- Tìm kiếm tên: `nameSearch` = bỏ dấu, `đ->d`, lowercase, gộp khoảng trắng; truy vấn dùng regex `escapeRegExp` (không dùng text index). Sắp xếp tên tiếng Việt dùng `collation({locale:'vi'})` hoặc `localeCompare('vi')`.
- Tên lớp/mã lớp ép HOA bằng `toLocaleUpperCase('vi')`; so khớp mã qua `codeKey` (NFC + lowercase).

---

## 5. Phụ thuộc ngoài và bẫy khi port sang TS / Next.js Route Handlers

| Phụ thuộc | Dùng cho | Ghi chú port |
|---|---|---|
| `mongoose` ^8.9 | toàn bộ DB | giữ nguyên được trong Next; cần singleton kết nối |
| `@google/generative-ai` ^0.24 + `axios` | parse đề (liệt kê model qua REST `v1beta/models`, thử tối đa 3 model, `temperature 0.1`, `responseMimeType json`, PDF inline <=15MB, input <=200k ký tự) | gọi mạng ngoài, chậm: cần `maxDuration` lớn; `axios` chỉ để list model (có thể thay `fetch`) |
| `pdf-parse` ^1.1.1 | trích text PDF | **bẫy (kiến thức chung, chưa kiểm trong nguồn):** pdf-parse 1.1.1 từng có lỗi đọc file test khi import ở một số bundler; nếu gặp thì import `pdf-parse/lib/pdf-parse.js` hoặc đánh dấu external |
| `mammoth` | docx -> HTML (đề) / raw text (tự luận) | Node-only |
| `bcrypt` (native) / `bcryptjs` | băm mật khẩu | native không chạy trên Edge/một số serverless; chuẩn bị fallback `bcryptjs` (đã có sẵn ý tưởng) |
| `jsonwebtoken` | JWT | Node-only; nếu muốn Edge dùng `jose` |
| `multer` | multipart (parse đề, import CSV, upload tự luận) | **không dùng được trong Route Handler**; thay bằng `request.formData()` hoặc `busboy` |
| `express-rate-limit`, `helmet`, `cors` | bảo mật | thay bằng middleware Next + lib rate limit; helmet -> `next.config` headers |
| `read-excel-file`, `write-excel-file` (ESM) | import/export xlsx | ESM-only, Node; giữ `import()` động |
| `undici` | proxy toàn cục cho `fetch` Gemini | Next dùng fetch riêng; cấu hình proxy cần `setGlobalDispatcher` ở `instrumentation.ts` |
| `mongodb-memory-server` | dev/test, và **fallback chạy thật khi không có DB** | chỉ dev/test; phải loại khỏi production bundle |
| `dotenv`, `uuid` | cấu hình | Next tự nạp `.env*` |

Bẫy cụ thể:
1. **Multipart + runtime:** mọi route nhận file phải khai `export const runtime = 'nodejs'`; tắt/không dùng body parser mặc định; kiểm tra kích thước **trước khi đọc hết** (Content-Length + giới hạn stream), tương đương `limits` của multer, `parts/fields` và timeout 90s thân request (`req.destroy()` không có sẵn trong Route Handler). Giới hạn 4.5MB body của Vercel/serverless sẽ chặn upload 20MB (đề) và 3MB media + overhead nếu triển khai trên đó.
2. **Body JSON theo tuyến (1mb/2mb/5mb):** Next không có parser theo route; phải tự đọc `request.text()` với trần byte và trả 413. Thứ tự "xác thực trước, đọc body sau" (5mb chỉ sau authenticate) cần giữ để không tốn tài nguyên cho request vô danh.
3. **Singleton kết nối Mongo:** dùng `globalThis` cache `mongoose.connect` promise (HMR dev + nhiều route module). Không `process.exit`/fallback in-memory trong request path; `seedRbac` phải chạy **một lần** (instrumentation hoặc lazy-once, idempotent) thay vì `index.js`.
4. **Trạng thái RAM theo tiến trình** (mất ý nghĩa trên serverless/nhiều instance): `examCache` (20s), cache role 60s, limiter tự viết (duplicate/upload), semaphore upload, `knownTokens`, `mediaUsage.bytes`, `dummyHash`, `pendingSessionCleanups`. Nếu chạy 1 Node server (`next start` trên VPS/Render) giữ được; nếu serverless phải chuyển sang Redis/Mongo hoặc chấp nhận suy giảm (xem rủi ro).
5. **Rate limit sau proxy:** `req.ip` phụ thuộc `TRUST_PROXY`; trong Next phải tự suy IP từ `x-forwarded-for` có kiểm số lớp tin cậy. Hành vi "chỉ tính lần sai" / "hoàn lượt khi 5xx" cần tự cài (express-rate-limit làm sẵn).
6. **Mongoose trong Next:** model đã khai báo thì `mongoose.models.X || mongoose.model(...)` (HMR); hook softDelete/ExamSitting dựa trên query middleware nên phải import model trước khi dùng `mongoose.model('Class')` (xem `requireClassPermission` dùng `mongoose.model` theo tên); index (unique partial, TTL) chỉ tạo khi `autoIndex`/`init()`; test cần `await Model.init()`.
7. **Binary:** `EssayMedia.data` là `Buffer` BSON; trả ảnh bằng `new Response(bytes, {headers})` (`Buffer` -> `Uint8Array`); nhớ `Content-Disposition`, `nosniff`, CSP `sandbox`, `no-store`. `media.data.buffer` ở lean doc là `Binary` -> cần `.buffer` (xem sendEssayMedia).
8. **Thời gian & múi giờ:** mọi định dạng hiển thị cố định UTC+7 tự tính offset; `toLocaleUpperCase('vi')`, `collation vi` phụ thuộc ICU của Node/Mongo.
9. **Giữ hợp đồng lỗi:** ngoại lệ ở 1.5 (upload dùng `status`, 409 chấm có `data`, `requireApiKey`) nếu UI mới phụ thuộc. Cân nhắc chuẩn hóa nhưng phải ghi quyết định.
10. **Static/SPA:** server cũ phục vụ `client/dist`; Next thay hoàn toàn bằng App Router, bỏ `/api/health` fallback `*`.
11. **Xác thực upload không qua `authenticate`:** route upload tự verify JWT **không kiểm `tokenVersion` và không kiểm `mustChangePassword`**; khi port nên dùng chung một hàm xác thực (nhưng giữ thứ tự: kiểm token phiên trước để giảm tải DB).
12. **Test:** bộ test nguồn dùng `node --test` + `mongodb-memory-server` + server HTTP thật; có thể tái sử dụng làm test hợp đồng (fixtures `server/tests/*Fixtures.js`).

---

## 6. Đề xuất module / milestone backend (theo thứ tự phụ thuộc)

Nguyên tắc: nền móng (CI, lint, test infra, in-memory Mongo, smoke test) ngay M0 (theo quy tắc 1.2).

| # | Module | Phụ thuộc | Nội dung | File nguồn tương ứng |
|---|---|---|---|---|
| M0 | Nền móng & hạ tầng | | cấu hình env có kiểm tra, kết nối Mongo singleton, `apiResponse` (`fail/wrap/parsePage/pageResult/toObjectId`), xử lý lỗi an toàn, helper test (in-memory Mongo + gọi handler), CI | `config/env.js`, `config/db.js`, `utils/apiResponse.js`, `utils/limits.js`, `utils/textUtils.js`, `utils/dateFormat.js`, `tests/helpers.js` |
| M1 | Bảo mật nền: rate limit, body limit, header | M0 | tương đương `rateLimit.js`, helmet/CORS, trần JSON theo route, 413/429 | `middlewares/rateLimit.js`, `app.js:14-62,110-144`, `config/proxy.js` |
| M2 | Người dùng, RBAC, phiên | M0, M1 | User, Role + `seedRbac`, `passwordHash` (cổng đồng thời), `secureField`, JWT + `tokenVersion`, `authenticate`/`requirePermission`/`requireApiKey`, 8 endpoint `/api/auth` | `models/User.js`, `models/Role.js`, `services/rbac.js`, `middlewares/authMiddleware.js`, `config/jwt.js`, `utils/passwordHash.js`, `utils/secureField.js`, `controllers/authController.js`, `routes/authRoutes.js` |
| M3 | Lớp học & thành viên | M2 | Class (softDelete, partial unique), ClassMember, `requireClassPermission`, mời, duyệt, tìm kiếm, rời lớp, `guardedDeleteMember`, đếm | `models/Class.js`, `models/ClassMember.js`, `models/plugins/softDelete.js`, `services/classMembers.js`, `controllers/classController.js`, `controllers/memberController.js`, `routes/classRoutes.js`, `routes/meRoutes.js` |
| M4 | Import/reset học sinh | M3 | CSV/XLSX parse an toàn, tạo hàng loạt + mật khẩu tạm, reset mật khẩu, sửa tên | `controllers/studentAdminController.js`, `utils/csvParse.js`, `utils/xlsxParse.js`, `utils/passwordHash.js` (phần Temp/Bulk) |
| M5 | Đề mẫu (CRUD, thùng rác) + validation câu hỏi | M2 | ExamTemplate, `questionSchema`, `sanitizeQuestions`/`computeScoring`/`buildEssayRubric`, nhân bản, khôi phục, purge, TTL | `models/ExamTemplate.js`, `models/schemas/questionSchema.js`, `utils/examValidation.js`, `utils/essayGrading.js`, `utils/examCopyName.js`, `controllers/templateController.js` (trừ parse), `routes/templateRoutes.js` |
| M6 | Tách đề bằng AI | M5 | multipart 20MB, trích PDF/Word, Gemini + chọn model/quota/PDF inline, chuẩn hóa câu | `controllers/templateController.js:43-107`, `utils/fileExtractor.js`, `utils/geminiParser.js`, `config/proxy.js` |
| M7 | Ca thi (giáo viên) | M3, M5 | ExamSitting + cache, SittingGrant, tạo/sửa/xóa, mã ca, overlap, khóa, đổi lớp, cấp/thu hồi quyền, candidates | `models/ExamSitting.js`, `models/SittingGrant.js`, `controllers/sittingController.js`, `services/sittingCode.js`, `services/sittingLookup.js`, `utils/examCache.js`, `utils/sittingOverlap.js`, `routes/sittingRoutes.js` (phần CRUD) |
| M8 | Làm bài (học sinh) | M7 | SittingSession, `resolve/start/session/submit`, đảo đề, chấm mcq, snapshot, chống nộp trùng, ẩn đáp án | `models/SittingSession.js`, `models/SittingSubmission.js`, `controllers/meSittingController.js`, `utils/examShuffle.js`, `routes/meSittingRoutes.js` |
| M9 | Tự luận: upload + media | M8 | EssayUpload/EssayMedia, route upload có token phiên, sniff file, trích docx/txt, trần kho, gắn vào bài nộp | `models/EssayUpload.js`, `models/EssayMedia.js`, `routes/essayUploadRoutes.js`, `services/essayUploadService.js`, `utils/fileSniff.js`, `config/essayUpload.js` |
| M10 | Chấm tay, chấm lại, kết quả giáo viên | M8, M9 | `overrideEssayResult`, `manualGradingStore`, `regrade` + `essayStale`, `getResults` (lọc/sắp xếp/đếm), grading-progress, xóa vi phạm, media giáo viên | `controllers/sittingResultsController.js`, `services/manualGradingStore.js`, `services/regrade.js`, `utils/essayDisplay.js` |
| M11 | Công bố & kết quả học sinh | M10 | publication info/publish/unpublish, `classifySubmission`, `computeResultScores`, `GET result` (+media) | `controllers/sittingPublicationController.js`, `services/sittingPublication.js`, `services/resultPublication.js`, `services/studentResult.js`, `meSittingController.js:446-483` |
| M12 | Xuất báo cáo | M10 | export JSON + xlsx (chống formula injection) | `utils/resultsXlsx.js`, `sittingResultsController.js:261-329` |
| M13 | Vận hành | tất cả | seed dev, sinh secret, kịch bản migration index nếu có dữ liệu cũ, kiểm thử tải | `scripts/*`, `tests/*load*.test.js` |

Thứ tự gợi ý khả thi tối thiểu (end-to-end sớm): M0 -> M1 -> M2 -> M3 -> M5 -> M7 -> M8 (trắc nghiệm trước) -> M11 (chỉ mcq) -> M9/M10 (tự luận) -> M6/M4/M12.

---

## 7. Rủi ro lớn nhất khi port

1. **Trạng thái RAM theo tiến trình trong luồng thi** (cache đề, limiter tự viết, semaphore + bộ nhớ token upload, bộ đếm kho media): trên serverless/nhiều instance cache bị sai lệch, giới hạn đồng thời không còn đúng. Quyết định sớm: triển khai `next start` đơn instance hay chuyển sang Redis/Mongo.
2. **Upload multipart và giới hạn nền tảng:** multer không dùng được; đề 20MB, media 3MB cùng giới hạn 4.5MB của serverless; cần streaming/busboy, giới hạn kích thước sớm, timeout body 90s, kiểm tra magic bytes/docx zip-bomb.
3. **Tính đúng đắn đồng thời của nộp bài/chấm điểm** dựa vào các thao tác Mongo nguyên tử (upsert `$setOnInsert`, unique index, pipeline update, `$elemMatch` + khóa lạc quan `baseGradedAt`, `publishAtomic`, `guardedDeleteMember`): port sang kiểu/ORM khác mà làm "đọc rồi ghi" sẽ gây nộp trùng, mất điểm, giáo viên cuối cùng bị gỡ.
4. **Đồng hồ và ân hạn phía server cùng quy tắc ca thi** (deadline = min(duration, closeAt), ân hạn 120s, cập nhật hàng loạt phiên khi đổi lịch, chấm lại toàn bộ bài khi sửa đáp án, `essayStale`): hồi quy ở đây ảnh hưởng điểm thật; cần test hợp đồng port từ bộ test nguồn (`sitting.*`, `me.*`, `publication.*`).
5. **Bảo mật/rò rỉ dữ liệu thi và tài khoản:** không để lộ `correctAnswer/explanation/rubric` trước khi công bố; không lộ `invite token`, Gemini key (mã hóa + mask), `temporaryPassword` (no-store); route upload tự xác thực bên ngoài `authenticate` (thiếu kiểm `tokenVersion`); cổng đồng thời bcrypt (503) và 12 loại rate limit; 404 thay 403 cho lớp không thuộc quyền. Sơ sẩy khi tách middleware sang Route Handlers rất dễ mở lỗ hổng.

Nguồn phụ: `docs/design/*` (8 file) và `CHANGELOG.md` phần lớn mô tả UI và quyết định thiết kế theo pha; backend hành vi chốt theo code ở trên (README mô tả "Gemini chấm tự luận" không còn đúng, code đã chuyển sang chấm tay).
