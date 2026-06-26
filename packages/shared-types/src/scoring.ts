import type { TrueFalseBranchScoring } from './index';

const DEFAULT_TRUE_FALSE_BRANCH: TrueFalseBranchScoring = {
  '1': 0.1,
  '2': 0.25,
  '3': 0.5,
  '4': 1.0,
};

export function scoreTrueFalse(
  selected: boolean[],
  correct: boolean[],
  branchMap: TrueFalseBranchScoring = DEFAULT_TRUE_FALSE_BRANCH,
): number {
  if (selected.length !== 4 || correct.length !== 4) return 0;
  const correctCount = selected.filter((v, i) => v === correct[i]).length;
  const key = String(correctCount) as keyof TrueFalseBranchScoring;
  return branchMap[key] ?? 0;
}

export function normalizeShortAnswer(
  input: string,
  options: Array<'comma_to_dot' | 'trim_whitespace'> = ['comma_to_dot', 'trim_whitespace'],
): string {
  let result = input;
  if (options.includes('trim_whitespace')) {
    result = result.trim();
  }
  if (options.includes('comma_to_dot')) {
    result = result.replace(/,/g, '.');
  }
  return result.toLowerCase();
}

export function compareShortAnswer(
  studentAnswer: string,
  correctAnswer: string,
  options?: Array<'comma_to_dot' | 'trim_whitespace'>,
): boolean {
  return normalizeShortAnswer(studentAnswer, options) === normalizeShortAnswer(correctAnswer, options);
}

export function scoreMcq(selected: string, correct: string, maxScore = 0.25): number {
  return selected === correct ? maxScore : 0;
}

export interface QuestionForScoring {
  id: string;
  type: 'mcq' | 'true_false' | 'short_answer' | 'essay' | 'cluster_mcq';
  correctKey: unknown;
  maxScore?: number;
}

export function scoreAnswer(
  question: QuestionForScoring,
  answer: unknown,
  rules?: { true_false_branch?: TrueFalseBranchScoring; short_answer_normalize?: Array<'comma_to_dot' | 'trim_whitespace'> },
): { score: number; maxScore: number; flagged: boolean } {
  const maxScore = question.maxScore ?? (question.type === 'mcq' ? 0.25 : question.type === 'true_false' ? 1.0 : 0.5);

  switch (question.type) {
    case 'mcq': {
      const score = scoreMcq(String(answer ?? ''), String(question.correctKey), maxScore);
      return { score, maxScore, flagged: false };
    }
    case 'true_false': {
      const selected = answer as boolean[];
      const correct = question.correctKey as boolean[];
      const score = scoreTrueFalse(selected, correct, rules?.true_false_branch);
      return { score, maxScore, flagged: false };
    }
    case 'short_answer': {
      const normalized = normalizeShortAnswer(String(answer ?? ''), rules?.short_answer_normalize);
      const correct = normalizeShortAnswer(String(question.correctKey), rules?.short_answer_normalize);
      const flagged = normalized.length > 0 && !/^-?[\d.]+$/.test(normalized) && normalized !== correct;
      const score = normalized === correct ? maxScore : 0;
      return { score, maxScore, flagged };
    }
    case 'essay': {
      const hasAnswer = String(answer ?? '').trim().length > 0;
      return { score: 0, maxScore, flagged: hasAnswer };
    }
    case 'cluster_mcq': {
      const score = scoreMcq(String(answer ?? ''), String(question.correctKey), maxScore);
      return { score, maxScore, flagged: false };
    }
    default:
      return { score: 0, maxScore, flagged: true };
  }
}
