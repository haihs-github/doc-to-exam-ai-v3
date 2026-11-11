// Created by Haihs on 11/11/2026
// Mongo connection singleton cached on globalThis (hot-reload safe).
import mongoose, { type ConnectOptions } from 'mongoose';
import { loadEnv } from './env';
import { connectWithFallback } from './memoryMongo';

const KEY = '__docToExamMongoose';
const g = globalThis as unknown as Record<string, Promise<typeof mongoose> | undefined>;

// export function connectDb(options: ConnectOptions = {}): Promise<typeof mongoose> { // Haihs: đóng code cũ, sửa cache chết sau disconnect và ném đồng bộ khi env sai - start
//   g[KEY] ??= mongoose
//     .connect(loadEnv().mongodbUri, { serverSelectionTimeoutMS: 8000, ...options })
//     .catch(() => {
//       g[KEY] = undefined; // do not cache a failure
//       // driver messages can embed the URI/host: use a fixed message
//       throw new Error('Cannot connect to MongoDB (check MONGODB_URI and that the server is reachable)');
//     });
//   return g[KEY]!;
// } // Haihs: đóng code cũ, sửa cache chết sau disconnect và ném đồng bộ khi env sai - end
export async function connectDb(options: ConnectOptions = {}): Promise<typeof mongoose> { // Haihs: async để lỗi env thành rejected promise; kết nối lại khi readyState 0/3 - start
  // Cache is cleared only on an explicit close or a failed connect: a transient readyState 0 is
  // the driver auto-reconnecting the SAME client, and a second connect would leak a MongoClient.
  if (!g[KEY]) {
    // const p: Promise<typeof mongoose> = mongoose // Haihs: đóng code cũ, fallback MongoDB in-memory cho dev/E2E (D16), loadEnv() vẫn chạy đồng bộ nên lỗi env nêu tên biến - start - end
    //   .connect(loadEnv().mongodbUri, { serverSelectionTimeoutMS: 8000, ...options }) // Haihs: đóng code cũ, fallback MongoDB in-memory cho dev/E2E (D16), loadEnv() vẫn chạy đồng bộ nên lỗi env nêu tên biến - start - end
    const p: Promise<typeof mongoose> = connectWithFallback(loadEnv(), { serverSelectionTimeoutMS: 8000, ...options }) // Haihs: fallback MongoDB in-memory cho dev/E2E (D16), loadEnv() vẫn chạy đồng bộ nên lỗi env nêu tên biến - start - end
      .then((m) => {
        m.connection.once('close', () => {
          if (g[KEY] === p) g[KEY] = undefined;
        });
        return m;
      })
      .catch(() => {
        if (g[KEY] === p) g[KEY] = undefined; // do not cache a failure
        // driver messages can embed the URI/host: use a fixed message
        throw new Error('Cannot connect to MongoDB (check MONGODB_URI and that the server is reachable)');
      });
    g[KEY] = p;
  }
  return g[KEY]!;
} // Haihs: async để lỗi env thành rejected promise; kết nối lại khi readyState 0/3 - end
// shortcut: no in-memory fallback (source db.js:295-297); deferred decision for a later milestone
