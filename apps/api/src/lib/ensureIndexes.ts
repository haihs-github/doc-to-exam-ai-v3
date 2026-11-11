// Created by Haihs on 11/11/2026
// Builds model indexes (unique phone/role name) before any traffic or seeding.
// TODO(api): Task 8 — instrumentation.register() phải gọi ensureIndexes() trước seedRbac()
import { RoleModel } from '../models/Role';
import { UserModel } from '../models/User';

export async function ensureIndexes(): Promise<void> {
  await Promise.all([UserModel.init(), RoleModel.init()]);
}
