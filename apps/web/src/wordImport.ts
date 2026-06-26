import type { ExamPackageQuestionRow } from '@vnu/shared-types';

export const MAX_WORD_IMPORT = 200;

export interface ParsedWordQuestion {
  stem: string;
  options?: string[];
  correctKey?: string | boolean[];
  type: 'mcq' | 'true_false' | 'short_answer';
  parseError?: string;
}

export interface WordParseResult {
  questions: ParsedWordQuestion[];
  errors: string[];
}

const MCQ_BLOCK =
  /Câu\s*(\d+)\s*[.:]\s*([\s\S]*?)(?=Câu\s*\d+\s*[.:]|$)/gi;

function normalizeText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/\t/g, ' ')
    .trim();
}

function parseMcqBlock(body: string): ParsedWordQuestion | null {
  const lines = body
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return null;

  const options: string[] = [];
  const stemLines: string[] = [];
  let answerKey: string | undefined;

  for (const line of lines) {
    const opt = /^([A-Da-d])[.)]\s*(.+)$/.exec(line);
    if (opt) {
      options.push(`${opt[1].toUpperCase()}. ${opt[2].trim()}`);
      continue;
    }
    const ans = /^(?:Đáp án|Dap an|Answer)\s*:\s*(.+)$/i.exec(line);
    if (ans) {
      answerKey = ans[1].trim();
      continue;
    }
    if (!options.length) stemLines.push(line);
  }

  const stem = stemLines.join('\n').trim();
  if (!stem) return null;

  if (options.length >= 2) {
    return {
      stem,
      options: options.slice(0, 4),
      correctKey: answerKey ?? 'A',
      type: 'mcq',
    };
  }

  if (answerKey != null) {
    return { stem, correctKey: answerKey, type: 'short_answer' };
  }

  return { stem, type: 'short_answer', correctKey: '' };
}

/** Parse pasted Word / plain text into MCQ blocks. */
export function parseWordText(text: string): WordParseResult {
  const normalized = normalizeText(text);
  const questions: ParsedWordQuestion[] = [];
  const errors: string[] = [];

  if (!normalized) {
    return { questions: [], errors: ['Văn bản trống'] };
  }

  const blocks = [...normalized.matchAll(MCQ_BLOCK)];
  if (!blocks.length) {
    errors.push('Không tìm thấy mẫu "Câu 1." — hãy dán đề có đánh số câu');
    return { questions, errors };
  }

  for (const m of blocks) {
    const num = m[1];
    const body = m[2]?.trim() ?? '';
    const parsed = parseMcqBlock(body);
    if (parsed) {
      questions.push(parsed);
    } else {
      errors.push(`Câu ${num}: không đọc được nội dung`);
    }
    if (questions.length >= MAX_WORD_IMPORT) break;
  }

  return { questions, errors };
}

export async function extractTextFromDocx(file: File): Promise<string> {
  const mammoth = await import('mammoth');
  const buf = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer: buf });
  return result.value;
}

export function toExamQuestions(
  parsed: ParsedWordQuestion[],
  subject: string,
  part: string,
  defaultScore: number,
): ExamPackageQuestionRow[] {
  return parsed.map((p) => {
    const content: Record<string, unknown> = { stem: p.stem };
    if (p.options) content.options = p.options;
    return {
      id: crypto.randomUUID(),
      subject,
      type: p.type,
      part,
      difficulty: 'medium',
      content,
      correctKey: p.correctKey ?? (p.type === 'mcq' ? 'A' : ''),
      maxScore: defaultScore,
    } as ExamPackageQuestionRow & { part?: string };
  });
}
