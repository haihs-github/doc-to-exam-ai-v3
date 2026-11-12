// Created by Haihs on 11/11/2026
// Shared auth DTOs (user, register/login/password/api-key bodies and results).
export type UserRole = 'teacher' | 'student' | 'admin';

export interface AuthUser {
  id: string;
  phoneNumber: string;
  fullName: string;
  role: UserRole;
  mustChangePassword: boolean;
  hasApiKey?: boolean;
  apiKeyLast4?: string;
}

export interface AuthResult {
  token: string;
  user: AuthUser;
}

export interface RegisterBody {
  phoneNumber: string;
  fullName: string;
  password: string;
  secretKey?: string;
  geminiApiKey?: string;
  website?: string;
}

export interface LoginBody {
  phoneNumber: string;
  password: string;
}

export interface ChangePasswordBody {
  currentPassword: string;
  newPassword: string;
}

export interface ApiKeyBody {
  geminiApiKey: string;
}

export interface ApiKeyState {
  hasApiKey: boolean;
  apiKeyLast4?: string;
}
