// Created by Haihs on 11/11/2026
// GET /api/health: liveness probe, same JSON as the source Express app.
import { withErrors } from '../../../src/lib/handler'; // Haihs: wire withErrors so next build exercises the contract import - start - end
import { ok } from '../../../src/lib/apiResponse';
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
// export const GET = withErrors(async (): Promise<Response> => {
//   return Response.json({
//     status: 'OK',
//     timestamp: new Date(),
//     service: 'Doc to Exam AI Backend',
//   });
// });
// Haihs: bọc GET bằng withErrors - end
// Haihs: health trả envelope ok() theo contract (D10) - start
// đóng code cũ: GET withErrors trả Response.json thô, comment nguyên văn ngay phía trên
export const GET = withErrors(async (): Promise<Response> => {
  return ok({ status: 'OK', timestamp: new Date().toISOString(), service: 'Doc to Exam AI Backend' });
});
// Haihs: health trả envelope ok() theo contract (D10) - end
