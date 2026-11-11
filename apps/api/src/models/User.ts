// Created by Haihs on 11/11/2026
// User account model (teacher|student|admin). Port of server/models/User.js; password policy lives in assertPasswordPolicy.
import type { AuthUser, UserRole } from '@doc-to-exam/contract';
import mongoose, { Schema, type HydratedDocument, type Model } from 'mongoose';
import { loadEnv } from '../lib/env';
import { HttpError } from '../lib/handler';
import { decryptField, encryptField, isEncrypted, last4 } from '../lib/secureField';
import { toProperName, toSearchKey } from '../lib/textUtils';

const FULL_NAME_MAX = 255;

export interface IUser {
  phoneNumber: string;
  fullName: string;
  nameSearch: string;
  mustChangePassword: boolean;
  password: string;
  geminiApiKey: string;
  tokenVersion: number;
  role: UserRole;
  createdAt: Date;
}

interface IUserMethods {
  /** Throws HttpError VALIDATION for an `enc:v1:` input (would be stored unencrypted); '' clears. Does not save. */
  setGeminiApiKey(plain: string): void;
  toAuthUser(): AuthUser;
}

type UserModelType = Model<IUser, object, IUserMethods>;

let warned = false;
/** Test hook: re-arm the one-time decrypt warning. */
export const resetWarned = (): void => {
  warned = false;
};
const readKey = (stored: string): string => {
  try {
    return decryptField(stored, loadEnv().apiKeyEncryptionSecret);
  } catch {
    // Undecryptable (rotated secret / tampered): treat as no key. Fixed message, never the stored value.
    if (!warned) {
      warned = true;
      console.warn('User.geminiApiKey: cannot decrypt a stored key; treating it as not configured');
    }
    return '';
  }
};

const hideSensitive = (_doc: unknown, ret: Record<string, unknown>): Record<string, unknown> => {
  for (const k of ['geminiApiKey', 'password', 'nameSearch', 'tokenVersion']) delete ret[k];
  return ret;
};

const assertPlainKey = (v: string): void => {
  if (isEncrypted(v.trim()))
    throw new HttpError('VALIDATION', 'API key không hợp lệ.', { field: 'geminiApiKey' });
};

const UserSchema = new Schema<IUser, UserModelType, IUserMethods>(
  {
    phoneNumber: {
      type: String,
      required: [true, 'Số điện thoại là bắt buộc'],
      unique: true,
      trim: true,
      // Defensive only. TODO(api): Task 7 — chuẩn hóa sdt bằng đúng hàm chuẩn hóa của limiter TRƯỚC khi lưu/tra
      // Haihs: Task 7 đã xử lý — parsePhone (authValidation.ts) trả 400 trước bcrypt/đăng ký; chuẩn hóa dùng lib/phone.ts - start - end
      match: [/^0\d{9,10}$/, 'Số điện thoại không hợp lệ'],
    },
    fullName: {
      type: String,
      required: [true, 'Họ và tên là bắt buộc'],
      trim: true,
      maxlength: [FULL_NAME_MAX, `Họ và tên tối đa ${FULL_NAME_MAX} ký tự.`],
      set: toProperName,
    },
    nameSearch: { type: String, default: '' },
    mustChangePassword: { type: Boolean, default: false },
    password: {
      type: String,
      required: [true, 'Mật khẩu là bắt buộc'],
      minlength: [6, 'Mật khẩu tối thiểu 6 ký tự'],
    },
    // Stored encrypted. The setter refuses `enc:v1:` input itself (encryptField would keep it as-is = stored unencrypted).
    geminiApiKey: {
      type: String,
      default: '',
      set: (v: unknown) => {
        if (typeof v !== 'string') return v;
        assertPlainKey(v);
        return encryptField(v.trim(), loadEnv().apiKeyEncryptionSecret);
      },
      get: (v: string | undefined) => (v ? readKey(v) : ''),
    },
    tokenVersion: { type: Number, default: 0 },
    role: {
      type: String,
      enum: ['teacher', 'student', 'admin'],
      default: 'teacher',
      immutable: true,
    },
    createdAt: { type: Date, default: Date.now },
  },
  {
    // virtuals (id) only: getters would decrypt the key on every serialisation. Use doc.geminiApiKey explicitly.
    toObject: { virtuals: true, transform: hideSensitive },
    toJSON: { virtuals: true, transform: hideSensitive },
  },
);

UserSchema.pre('validate', function setNameSearch() {
  if (this.isNew || this.isModified('fullName')) this.nameSearch = toSearchKey(this.fullName);
});
// pre('validate') does not run on query updates: keep nameSearch in sync there too.
UserSchema.pre(['updateOne', 'findOneAndUpdate', 'updateMany'], function syncNameSearch() {
  const u = this.getUpdate();
  if (!u || Array.isArray(u)) return;
  const rec = u as Record<string, unknown>;
  const set = rec.$set as Record<string, unknown> | undefined;
  const name = set?.fullName ?? rec.fullName;
  if (typeof name === 'string') rec.$set = { ...set, nameSearch: toSearchKey(name) };
});
UserSchema.index({ role: 1, nameSearch: 1 });

UserSchema.methods.setGeminiApiKey = function setGeminiApiKey(
  this: HydratedDocument<IUser>,
  plain: string,
): void {
  assertPlainKey(plain); // explicit so callers get HttpError (Mongoose would wrap a setter throw)
  this.geminiApiKey = plain;
};

UserSchema.methods.toAuthUser = function toAuthUser(this: HydratedDocument<IUser>): AuthUser {
  const user: AuthUser = {
    id: String(this._id),
    phoneNumber: this.phoneNumber,
    fullName: this.fullName,
    role: this.role,
    mustChangePassword: this.mustChangePassword,
  };
  if (this.role === 'teacher') {
    const key = this.geminiApiKey;
    user.hasApiKey = !!key;
    if (key) user.apiKeyLast4 = last4(key);
  }
  return user;
};

export const UserModel: UserModelType =
  (mongoose.models.User as UserModelType | undefined) ??
  mongoose.model<IUser, UserModelType>('User', UserSchema);
