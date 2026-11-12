// Created by Haihs on 11/11/2026
// Builds model indexes (unique phone/role name) before any traffic or seeding.
// TODO(api): Task 8 — instrumentation.register() phải gọi ensureIndexes() trước seedRbac()
// Haihs: đã xử lý ở instrumentation.ts (ensureIndexes() chạy trước seedRbac) - start - end
import { ClassMemberModel } from '../models/ClassMember';
import { ClassModel } from '../models/Class';
import { RoleModel } from '../models/Role';
import { UserModel } from '../models/User';

// Haihs: init thêm Class/ClassMember (unique partial activeCodeKey) - start
// đóng code cũ
// export async function ensureIndexes(): Promise<void> {
//   await Promise.all([UserModel.init(), RoleModel.init()]);
// }
export async function ensureIndexes(): Promise<void> {
  await Promise.all([UserModel.init(), RoleModel.init(), ClassModel.init(), ClassMemberModel.init()]);
}
// Haihs: init thêm Class/ClassMember (unique partial activeCodeKey) - end
