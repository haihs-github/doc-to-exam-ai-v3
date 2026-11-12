// Created by Haihs on 11/11/2026
// Route table of the web app (source: client/src/App.jsx route list, M1 subset).
import { Injector, inject, runInInjectionContext } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { CanActivateFn, GuardResult, Router, Routes } from '@angular/router';
import { filter, map, take } from 'rxjs';
import { AuthService } from './core/auth.service';
import { authGuard } from './core/auth.guard';
import { ChangePassword } from './pages/change-password';
import { Login } from './pages/login';
import { About } from './pages/about';
import { HomePlaceholder } from './pages/placeholders';
import { Register } from './pages/register';
import { SessionError } from './pages/session-error';
import { JoinClass } from './pages/join-class'; // Haihs: M2 Task 14 - trang học sinh - start - end
import { MyClassDetail } from './pages/my-class-detail'; // Haihs: M2 Task 14 - start - end
import { MyClasses } from './pages/my-classes'; // Haihs: M2 Task 14 - start - end
import { TeacherTemplates } from './pages/teacher-templates'; // Haihs: M3 - trang đề mẫu - start - end
import { TemplateEditor } from './pages/template-editor'; // Haihs: M3 - start - end
import { SittingCreate } from './pages/sitting-create'; // Haihs: M4 - ca thi giáo viên - start - end
import { SittingEditor } from './pages/sitting-editor'; // Haihs: M4 - start - end
import { TeacherSittingDetail } from './pages/teacher-sitting-detail'; // Haihs: M4 - start - end
import { TeacherSittings } from './pages/teacher-sittings'; // Haihs: M4 - start - end
import { ExamRoom } from './pages/exam-room'; // Haihs: M5 - học sinh làm bài - start - end
import { ExamSuccess } from './pages/exam-success'; // Haihs: M5 - start - end
import { MySittings } from './pages/my-sittings'; // Haihs: M5 - start - end
import { SittingEntry } from './pages/sitting-entry'; // Haihs: M5 - start - end
import { TeacherClasses } from './pages/teacher-classes';
import { TeacherClassDetail } from './pages/teacher-class-detail'; // Haihs: M2 Task 12 - chi tiết lớp - start - end

/** Runs `decide` once the startup /me load is over (same wait as authGuard: no flash of the wrong page). */
const afterLoad = (decide: () => GuardResult) => {
  const auth = inject(AuthService);
  return auth.isLoading()
    ? toObservable(auth.isLoading).pipe(
        filter((l) => !l),
        take(1),
        map(decide),
      )
    : decide();
};

/**
 * `/`: guest -> /about; otherwise authGuard() (loadError -> /session-error, mustChangePassword -> /change-password)
 * and the page itself is HomePlaceholder. Loop-free by design: the role homes (/sittings, /teacher/templates)
 * do not exist yet, so they fall through `**` to `/`, which for a logged-in user renders a page instead of redirecting.
 */
const rootGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const injector = inject(Injector); // the decision may run after the load, outside the injection context
  return afterLoad(
    () =>
      !auth.user() && !auth.loadError()
        ? router.parseUrl('/about')
        : (runInInjectionContext(injector, () => authGuard()(route, state)) as GuardResult), // isLoading is false here: synchronous
  );
};

/** /session-error only makes sense with a pending loadError; otherwise go home (which decides by session). */
const sessionErrorGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return afterLoad(() => (!auth.user() && auth.loadError() ? true : router.parseUrl('/')));
};

export const routes: Routes = [
  { path: '', pathMatch: 'full', canActivate: [rootGuard], component: HomePlaceholder },
  { path: 'about', component: About },
  { path: 'login', component: Login, data: { audience: 'student' } },
  { path: 'register', component: Register, data: { audience: 'student' } },
  { path: 'teacher/login', component: Login, data: { audience: 'teacher' } },
  { path: 'teacher/register', component: Register, data: { audience: 'teacher' } },
  // the only page a mustChangePassword user can reach
  { path: 'change-password', canActivate: [authGuard()], component: ChangePassword },
  { path: 'session-error', canActivate: [sessionErrorGuard], component: SessionError },
  { path: 'teacher/classes', canActivate: [authGuard(['teacher'], 'teacher')], component: TeacherClasses }, // Haihs: M2 Task 11 - trang danh sách lớp của giáo viên - start - end
  { path: 'teacher/classes/:id', canActivate: [authGuard(['teacher'], 'teacher')], component: TeacherClassDetail }, // Haihs: M2 Task 12 - chi tiết lớp giáo viên - start - end
  // Haihs: M2 Task 14 - /join mọi vai trò (khách bị đưa đến đăng nhập, state.from giữ đúng link), /classes cho học sinh - start
  { path: 'join', canActivate: [authGuard()], component: JoinClass },
  { path: 'join/:token', canActivate: [authGuard()], component: JoinClass },
  { path: 'classes', canActivate: [authGuard(['student'], 'student')], component: MyClasses },
  { path: 'classes/:id', canActivate: [authGuard(['student'], 'student')], component: MyClassDetail },
  // Haihs: M2 Task 14 - end
  // Haihs: M3 - đề mẫu giáo viên: danh sách/thùng rác, soạn mới, sửa - start
  { path: 'teacher/templates', canActivate: [authGuard(['teacher'], 'teacher')], component: TeacherTemplates },
  { path: 'teacher/templates/new', canActivate: [authGuard(['teacher'], 'teacher')], component: TemplateEditor },
  { path: 'teacher/templates/:id/edit', canActivate: [authGuard(['teacher'], 'teacher')], component: TemplateEditor },
  // Haihs: M3 - end
  // Haihs: M4 - ca thi giáo viên - start
  { path: 'teacher/sittings', canActivate: [authGuard(['teacher'], 'teacher')], component: TeacherSittings },
  { path: 'teacher/sittings/new', canActivate: [authGuard(['teacher'], 'teacher')], component: SittingCreate },
  { path: 'teacher/sittings/:id', canActivate: [authGuard(['teacher'], 'teacher')], component: TeacherSittingDetail },
  { path: 'teacher/sittings/:id/edit', canActivate: [authGuard(['teacher'], 'teacher')], component: SittingEditor },
  // Haihs: M4 - end
  // Haihs: M5 - ca thi của học sinh (giáo viên chủ ca được thi thử): danh sách, vào ca, phòng thi, xong - start
  { path: 'sittings', canActivate: [authGuard(['student'], 'student')], component: MySittings },
  { path: 'ca/:code', canActivate: [authGuard(['student', 'teacher'], 'student')], component: SittingEntry },
  { path: 'ca/:code/room', canActivate: [authGuard(['student', 'teacher'], 'student')], component: ExamRoom },
  { path: 'ca/:code/done', canActivate: [authGuard(['student', 'teacher'], 'student')], component: ExamSuccess },
  // Haihs: M5 - end
  { path: '**', redirectTo: '' },
];
