// Created by Haihs on 11/11/2026
// GET /api/health: liveness probe, same JSON as the source Express app.
import { withErrors } from '../../../src/lib/handler'; // Haihs: wire withErrors so next build exercises the contract import - start - end
export const runtime = 'nodejs';

// Haihs: bọc GET bằng withErrors - start
// đóng code cũ
// export async function GET(): Promise<Response> {
//   return Response.json({
//     status: 'OK',
//     timestamp: new Date(),
//     service: 'Doc to Exam AI Backend',
//   });
// }
export const GET = withErrors(async (): Promise<Response> => {
  return Response.json({
    status: 'OK',
    timestamp: new Date(),
    service: 'Doc to Exam AI Backend',
  });
});
// Haihs: bọc GET bằng withErrors - end
