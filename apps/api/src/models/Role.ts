// Created by Haihs on 11/11/2026
// RBAC role: unique name + permission codes (resource:action). Port of server/models/Role.js.
import mongoose, { Schema, type Model } from 'mongoose';

export interface IRole {
  name: string;
  permissions: string[];
}

const RoleSchema = new Schema<IRole>({
  name: { type: String, required: true, unique: true, trim: true },
  permissions: { type: [String], default: [] },
});

export const RoleModel: Model<IRole> =
  (mongoose.models.Role as Model<IRole> | undefined) ?? mongoose.model<IRole>('Role', RoleSchema);
