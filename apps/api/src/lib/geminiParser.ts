// Created by Haihs on 12/11/2026
// Exam parsing with Google Gemini: model choice by version score, JSON cleaning, question normalisation. Port of server/utils/geminiParser.js.
import type { ParsedExam } from '@doc-to-exam/contract';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { buildEssayRubric } from './examValidation';
import { ESSAY_INSTRUCTION, SYSTEM_INSTRUCTION } from './geminiPrompts';
import { HttpError } from './handler';
import { setupProxy } from './proxy';

// A wrong API key must not wait through dozens of models, so only a few are tried in turn.
const MAX_MODEL_ATTEMPTS = 3;
const MAX_INPUT_CHARS = 200000; // keeps the prompt inside the context window
const MAX_INLINE_PDF_BYTES = 15 * 1024 * 1024; // PDF sent along (multimodal) so the AI sees underlines
const OPTION_KEYS = ['A', 'B', 'C', 'D'] as const;
// Narrow keywords: only a hint for needsReview, NEVER turns a question into an essay by itself (an mcq that lost its options would be misread).
const ESSAY_KEYWORDS =
  /\bwrite\s+(a|an|about|your|the)\b|\babout\s+\d+\s+words\b|\bessay\b|viết\s+(một\s+)?(đoạn|bài|thư)|tự luận|bài luận|\bpart\s*\d*\.?\s*writing\b/i;

const API_KEY_MESSAGE =
  'Gemini API Key không hợp lệ hoặc không có quyền truy cập. Vui lòng kiểm tra lại API Key trong phần cài đặt tài khoản.';
// User-visible error (400) that stops the model loop.
const userError = (message: string) => new HttpError('VALIDATION', message);
const apiKeyError = (message = API_KEY_MESSAGE) => new HttpError('REQUIRE_API_KEY', message);
// Document-content error: shown to the teacher but does NOT stop the model loop.
class PublicError extends Error {
  readonly publicMessage: string;
  constructor(message: string) {
    super(message);
    this.publicMessage = message;
  }
}

const text = (err: unknown): string =>
  `${(err as { message?: string } | null)?.message ?? ''}`.toLowerCase();
const isApiKeyError = (err: unknown): boolean => {
  const t = text(err);
  return (
    t.includes('api key not valid') ||
    t.includes('api_key_invalid') ||
    t.includes('permission_denied') ||
    t.includes('unauthenticated') ||
    t.includes('[401') ||
    t.includes('[403')
  );
};
const isQuotaError = (err: unknown): boolean => {
  const t = text(err);
  return t.includes('quota') || t.includes('rate limit') || t.includes('[429');
};
const isInlineDataUnsupported = (err: unknown): boolean => {
  const t = text(err);
  return (
    t.includes('inline') ||
    t.includes('mime') ||
    t.includes('unsupported') ||
    t.includes('invalid argument') ||
    t.includes('[400')
  );
};

/** Strips ```json fences; falls back to the outermost {...}. */
export function cleanAndParseJSON(rawText: unknown): Record<string, unknown> {
  let cleaned = String(rawText ?? '').trim();
  if (cleaned.startsWith('```'))
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch (err) {
    const first = cleaned.indexOf('{');
    const last = cleaned.lastIndexOf('}');
    if (first !== -1 && last !== -1 && last > first)
      return JSON.parse(cleaned.substring(first, last + 1)) as Record<string, unknown>;
    throw new Error(`Không thể parse JSON từ phản hồi của AI: ${(err as Error).message}`, { cause: err });
  }
}

/** Preference by the VERSION number in the name, so new Google models win without a code change. */
export function scoreModelName(name: string): number {
  const lower = name.toLowerCase();
  const isAlias = lower.endsWith('-latest'); // aliases always exist
  const versionMatch = lower.match(/gemini-(\d+(?:\.\d+)?)/);
  const version = isAlias ? 100 : versionMatch ? parseFloat(versionMatch[1]) : 0;
  let score = version * 10;
  if (lower.includes('flash')) score += 5;
  else if (lower.includes('pro')) score += 3;
  if (lower.includes('lite')) score -= 4;
  if (/preview|exp|experimental/.test(lower)) score -= 30;
  return score;
}

export const isUnsuitableModel = (name: string): boolean =>
  /embedding|aqa|imagen|veo|lyria|banana|tts|audio|speech|transcribe|live|image|vision|robotics|computer-use|deep-research|antigravity|customtools|gemma|omni/i.test(
    name,
  );

/** Best models of this API key (max MAX_MODEL_ATTEMPTS); "-latest" aliases when the listing fails. */
export async function getAvailableGeminiModels(apiKey: string): Promise<string[]> {
  const fallback = ['gemini-flash-latest', 'gemini-pro-latest', 'gemini-flash-lite-latest'];
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (res.status === 400 || res.status === 401 || res.status === 403) throw apiKeyError();
    if (res.ok) {
      const data = (await res.json()) as {
        models?: { name: string; supportedGenerationMethods?: string[] }[];
      };
      if (Array.isArray(data.models)) {
        const names = data.models
          .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
          .map((m) => m.name.replace('models/', ''))
          .filter((n) => !isUnsuitableModel(n))
          .sort((a, b) => scoreModelName(b) - scoreModelName(a));
        if (names.length > 0) return names.slice(0, MAX_MODEL_ATTEMPTS);
      }
    }
  } catch (err) {
    if (err instanceof HttpError) throw err;
    console.warn('Cannot list models through the API:', (err as Error).message);
  }
  return fallback.slice(0, MAX_MODEL_ATTEMPTS);
}

/** AI rubric -> usable criteria; missing -> the default rubric (5 x 0.5). maxScore always follows the criteria sum. */
function normalizeEssayRubric(rawRubric: unknown) {
  const seen = new Set<string>();
  const usable: { key: string; label: string; max: number }[] = [];
  (Array.isArray(rawRubric) ? rawRubric : []).forEach(
    (item: Record<string, unknown> | null, idx) => {
      const label = String(item?.label ?? '').trim();
      const max = Number(item?.max);
      if (!label || !Number.isFinite(max) || max <= 0) return;
      let key = String(item?.key ?? '').trim() || `c${idx + 1}`;
      if (seen.has(key)) key = `${key}_${idx + 1}`;
      seen.add(key);
      usable.push({ key, label, max });
    },
  );
  const built = buildEssayRubric(usable, undefined);
  return { rubric: built.rubric, maxScore: built.maxScore };
}

type ParsedQuestion = Record<string, unknown>;

/**
 * Question type is decided by the SERVER: A/B present = mcq (even if the AI says essay); no options and the AI says
 * essay = essay; ambiguous ones are kept with needsReview instead of being dropped silently. Only fully empty ones are skipped.
 * Ids are renumbered 1..n here (the exam does not exist yet, so no answer refers to them).
 */
export function normalizeParsedQuestions(rawQuestions: unknown[]): {
  questions: ParsedQuestion[];
  skipped: number;
} {
  const questions: ParsedQuestion[] = [];
  let skipped = 0;
  for (const raw of rawQuestions) {
    const q = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    let questionText = String(q.questionText ?? '').trim();
    if (/^A\..*B\..*C\..*D\./i.test(questionText)) questionText = ''; // the 4 options glued into the stem
    const rawOptions = (q.options ?? {}) as Record<string, unknown>;
    const options = {} as Record<(typeof OPTION_KEYS)[number], string>;
    OPTION_KEYS.forEach((k) => {
      options[k] = String(rawOptions[k] ?? '').trim();
    });

    if (!options.A || !options.B) {
      const context = String(q.context ?? '').trim();
      const requirements = String(q.requirements ?? '').trim();
      const filled = OPTION_KEYS.filter((k) => options[k]).length;
      if (!questionText && !requirements && !context && filled === 0) {
        skipped += 1; // nothing to review
        continue;
      }
      const aiSaysEssay =
        String(q.type ?? '')
          .trim()
          .toLowerCase() === 'essay';
      // only this question's own text counts, not the group context shared by the whole part
      const looksLikeEssay = ESSAY_KEYWORDS.test(`${questionText} ${requirements}`);
      if (filled === 0 && aiSaysEssay) {
        const { rubric, maxScore } = normalizeEssayRubric(q.rubric);
        questions.push({
          id: questions.length + 1,
          type: 'essay',
          context,
          questionText,
          requirements,
          rubric,
          maxScore,
          explanation: String(q.explanation ?? '').trim(),
        });
        continue;
      }
      questions.push({
        id: questions.length + 1,
        context,
        questionText,
        options,
        correctAnswer: '',
        explanation: String(q.explanation ?? '').trim(),
        needsReview: true,
        reviewReason: looksLikeEssay
          ? 'Câu không có phương án và có dấu hiệu là câu tự luận (yêu cầu viết): hãy xác nhận đổi sang loại tự luận.'
          : 'Câu thiếu phương án A/B và không rõ là tự luận: hãy chọn loại câu hỏi hoặc bổ sung phương án.',
      });
      continue;
    }
    let correctAnswer = String(q.correctAnswer ?? '')
      .trim()
      .toUpperCase();
    if (
      !(OPTION_KEYS as readonly string[]).includes(correctAnswer) ||
      !options[correctAnswer as 'A']
    )
      correctAnswer = 'A';
    questions.push({
      id: questions.length + 1,
      context: String(q.context ?? '').trim(),
      questionText,
      options,
      correctAnswer,
      explanation: String(q.explanation ?? '').trim(),
    });
  }
  return { questions, skipped };
}

/** Extracts questions from the document text (and the PDF itself when small enough). Throws HttpError for the teacher. */
export async function parseExamWithGemini(
  apiKey: string,
  fileText: string,
  fileName = '',
  fileBuffer: Buffer | null = null,
  mimetype = '',
): Promise<ParsedExam & { title?: string; description?: string }> {
  if (!apiKey) throw apiKeyError('Thiếu Gemini API Key. Vui lòng nhập API Key trong phần cài đặt.');
  await setupProxy();
  const genAI = new GoogleGenerativeAI(apiKey);
  const modelNames = await getAvailableGeminiModels(apiKey);
  const truncated =
    fileText.length > MAX_INPUT_CHARS
      ? `${fileText.slice(0, MAX_INPUT_CHARS)}\n...[đã cắt bớt]`
      : fileText;
  const promptText = `${SYSTEM_INSTRUCTION}\n\n${ESSAY_INSTRUCTION}\n\nTên file: ${fileName}\n\nNỘI DUNG VĂN BẢN TRÍCH XUẤT TỪ ĐỀ THI:\n\n${truncated}`;
  const isPdf =
    (mimetype === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')) &&
    Buffer.isBuffer(fileBuffer) &&
    fileBuffer.length <= MAX_INLINE_PDF_BYTES;

  let lastError: unknown = null;
  let quotaExhausted = 0;
  for (const modelName of modelNames) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
      });
      const contents = isPdf
        ? [
            {
              inlineData: {
                data: (fileBuffer as Buffer).toString('base64'),
                mimeType: 'application/pdf',
              },
            },
            promptText,
          ]
        : promptText;
      let result;
      try {
        result = await model.generateContent(contents);
      } catch (multiErr) {
        // retry as plain text only when the attachment itself is the problem (not a bad key / quota)
        if (
          !isPdf ||
          isApiKeyError(multiErr) ||
          isQuotaError(multiErr) ||
          !isInlineDataUnsupported(multiErr)
        )
          throw multiErr;
        console.warn(
          `Model ${modelName} cannot read the attached PDF, retrying as plain text:`,
          (multiErr as Error).message,
        );
        result = await model.generateContent(promptText);
      }
      const response = result.response;
      const finish = response.candidates?.[0]?.finishReason as string | undefined;
      if (finish === 'MAX_TOKENS')
        throw userError(
          'Đề thi quá dài nên AI bị cắt ngang khi trả kết quả. Vui lòng tách nhỏ file đề thi rồi thử lại.',
        );
      if (finish === 'SAFETY' || finish === 'PROHIBITED_CONTENT')
        throw userError('Nội dung tài liệu bị Google chặn vì lý do an toàn nội dung.');

      const data = cleanAndParseJSON(response.text());
      if (!Array.isArray(data.questions) || data.questions.length === 0)
        throw new PublicError('AI không tìm thấy câu hỏi trắc nghiệm nào trong tài liệu này.');
      const { questions, skipped } = normalizeParsedQuestions(data.questions);
      if (questions.length === 0)
        throw new PublicError('AI không trích xuất được câu hỏi hợp lệ nào (thiếu phương án A/B).');
      return {
        title: typeof data.title === 'string' ? data.title : undefined,
        description: typeof data.description === 'string' ? data.description : undefined,
        questions: questions as unknown as ParsedExam['questions'],
        totalQuestions: questions.length,
        skippedQuestions: skipped,
        needsReviewQuestions: questions.filter((q) => q.needsReview).length,
        model: modelName,
      };
    } catch (err) {
      if (err instanceof HttpError) throw err;
      // a wrong key makes other models pointless: stop and say so
      if (isApiKeyError(err)) throw apiKeyError();
      // quota is per model: keep trying the others. 503 "high demand" is a temporary overload of one model too.
      if (isQuotaError(err)) quotaExhausted += 1;
      else console.warn(`Error with model ${modelName}:`, (err as Error).message);
      lastError = err;
    }
  }
  if (quotaExhausted === modelNames.length)
    throw userError(
      'Tất cả model Gemini khả dụng đều đã hết hạn mức sử dụng trong hôm nay (quota). ' +
        'Hạn mức của gói miễn phí được đặt lại vào 15:00 giờ Việt Nam hằng ngày. ' +
        'Bạn có thể thử lại sau, dùng API Key khác, hoặc bật thanh toán cho dự án Google Cloud để nâng hạn mức.',
    );
  // neither the model names nor Google's raw error reach the client; they are only logged
  console.error(
    `Exam parsing failed after ${modelNames.length} model(s) (${modelNames.join(', ')}):`,
    (lastError as Error | null)?.message,
  );
  if (lastError instanceof PublicError) throw userError(lastError.publicMessage);
  throw new HttpError('INTERNAL', 'Phân tích đề thi thất bại, vui lòng thử lại sau.');
}
