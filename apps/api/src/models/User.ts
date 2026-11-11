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

const UserSchema = new Schema<IUser, UserModelType, IUserMethods>(
  {
    phoneNumber: {
      type: String,
      required: [true, 'Số điện thoại là bắt buộc'],
      unique: true,
      trim: true,
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
    // Stored encrypted; only setGeminiApiKey should write it (the setter is a plain encrypt, no input validation).
    geminiApiKey: {
      type: String,
      default: '',
      set: (v: unknown) =>
        typeof v === 'string' ? encryptField(v.trim(), loadEnv().apiKeyEncryptionSecret) : v,
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
    toObject: { getters: true },
    toJSON: {
      getters: true,
      transform: (_doc, ret: Record<string, unknown>) => {
        for (const k of ['geminiApiKey', 'password', 'nameSearch', 'tokenVersion']) delete ret[k];
        return ret;
      },
    },
  },
);

UserSchema.pre('validate', function setNameSearch() {
  if (this.isNew || this.isModified('fullName')) this.nameSearch = toSearchKey(this.fullName);
});
UserSchema.index({ role: 1, nameSearch: 1 });

UserSchema.methods.setGeminiApiKey = function setGeminiApiKey(
  this: HydratedDocument<IUser>,
  plain: string,
): void {
  if (isEncrypted(plain.trim())) {
    throw new HttpError('VALIDATION', 'API key không hợp lệ.', { field: 'geminiApiKey' });
  }
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
