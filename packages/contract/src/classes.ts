// Created by Haihs on 12/11/2026
// Shared DTO/body types for classes, members, invites and student CSV import (M2).

export type ClassStatus = 'active' | 'graduated';
export type MembershipStatus = 'pending' | 'approved';

export interface ClassDto {
  id: string;
  name: string;
  code: string;
  startYear: number;
  endYear: number;
  status: ClassStatus;
  deletedAt?: string | null;
  studentCount: number;
  teacherCount: number;
  membershipStatus?: MembershipStatus;
}

export interface ClassMemberDto {
  userId: string;
  fullName: string;
  phoneNumber?: string;
  status: MembershipStatus;
  requestedAt: string;
  approvedAt?: string;
}

export interface InviteState {
  token: string;
  enabled: boolean;
  rotatedAt?: string;
}

export interface InviteDto {
  student: InviteState;
  teacher: InviteState;
}

export interface ClassBody {
  name: string;
  code: string;
  startYear: number;
  endYear: number;
  status?: ClassStatus;
}

export interface ImportResultRow {
  row: number;
  status: 'created' | 'added' | 'alreadyMember' | 'error';
  fullName: string;
  phoneNumber: string;
  temporaryPassword?: string;
  message?: string;
}

export interface ImportSummary {
  total: number;
  created: number;
  added: number;
  alreadyMember: number;
  errors: number;
}

export interface TempPasswordResult {
  temporaryPassword: string;
}
