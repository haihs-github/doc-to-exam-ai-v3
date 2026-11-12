// Created by Haihs on 13/11/2026
// Prints fresh random secrets for apps/api/.env (JWT, API-key encryption, teacher registration key). Run: node scripts/generate-secrets.mjs
import { randomBytes } from 'node:crypto';

const hex = (n) => randomBytes(n).toString('hex');
console.log(`JWT_SECRET=${hex(48)}`);
console.log(`API_KEY_ENCRYPTION_SECRET=${hex(32)}`);
console.log(`TEACHER_SECRET_KEY=${hex(12)}`);
