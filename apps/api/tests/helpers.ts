// Created by Haihs on 11/11/2026
// Test helpers: in-memory MongoDB and a Route Handler caller.
import { MongoMemoryServer } from 'mongodb-memory-server';

export async function startTestDb(): Promise<{ uri: string; stop(): Promise<void> }> {
  const server = await MongoMemoryServer.create();
  return { uri: server.getUri(), stop: async () => void (await server.stop()) };
}

// Prettier would move the end-of-line eslint-disable/Haihs marker off the signature line.
// prettier-ignore
export async function call(
  handler: (req: Request) => Promise<Response>,
  init: { method?: string; url?: string; body?: unknown; headers?: Record<string, string> } = {},
// ): Promise<{ status: number; body: any }> { // Haihs: đóng code cũ, silence no-explicit-any có sẵn từ Task 4 - start - end
): Promise<{ status: number; body: any }> { // eslint-disable-line @typescript-eslint/no-explicit-any -- arbitrary JSON // Haihs: silence no-explicit-any có sẵn từ Task 4 - start - end
  const headers: Record<string, string> = { ...init.headers };
  if (init.body !== undefined) headers['content-type'] ??= 'application/json';
  const res = await handler(
    new Request(init.url ?? 'http://localhost/', {
      method: init.method ?? 'GET',
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    }),
  );
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : undefined };
}
