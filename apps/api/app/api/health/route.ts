// Created by Haihs on 11/11/2026
// GET /api/health: liveness probe, same JSON as the source Express app.
export const runtime = 'nodejs';

export async function GET(): Promise<Response> {
  return Response.json({
    status: 'OK',
    timestamp: new Date(),
    service: 'Doc to Exam AI Backend',
  });
}
