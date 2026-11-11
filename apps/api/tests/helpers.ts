// Created by Haihs on 11/11/2026
// Test helpers: in-memory MongoDB and a Route Handler caller.
import { MongoMemoryServer } from 'mongodb-memory-server';

export async function startTestDb(): Promise<{ uri: string; stop(): Promise<void> }> {
  const server = await MongoMemoryServer.create();
  return { uri: server.getUri(), stop: async () => void (await server.stop()) };
}

export async function call(
  handler: (req: Request) => Promise<Response>,
  init: { method?: string; url?: string; body?: unknown; headers?: Record<string, string> } = {},
): Promise<{ status: number; body: any }> { // eslint-disable-line @typescript-eslint/no-explicit-any -- test helper returns arbitrary JSON // Haihs: lint error có sẵn từ Task 4, eslint root chưa xanh - start - end
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
