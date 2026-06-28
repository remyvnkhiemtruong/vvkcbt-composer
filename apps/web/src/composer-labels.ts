import { getDefaultStructure } from '@vnu/shared-types';
import type { ExamPartConfig } from '@vnu/shared-types';

const QUESTION_TYPE_VI: Record<string, string> = {
  mcq: 'Trắc nghiệm',
  true_false: 'Đúng/Sai',
  short_answer: 'Trả lời ngắn',
  essay: 'Tự luận',
  cluster_mcq: 'MCQ chùm',
};

const CLUSTER_SUBTYPE_VI: Record<string, string> = {
  fill_notice: 'Điền từ — Thông báo',
  fill_flyer: 'Điền từ — Tờ rơi',
  reorder: 'Sắp xếp câu',
  fill_gap: 'Điền từ — Đoạn văn',
  reading_8: 'Đọc hiểu (8 câu)',
  reading_10: 'Đọc hiểu (10 câu)',
};

const PART_TYPE_VI: Record<string, string> = {
  mcq: 'Trắc nghiệm',
  true_false: 'Đúng/Sai',
  short_answer: 'Trả lời ngắn',
  essay: 'Tự luận',
  cluster_mcq: 'Câu hỏi chùm',
};

function partNumber(partKey: string): number {
  const m = /^part(\d+)/i.exec(partKey);
  return m ? Number(m[1]) : 0;
}

function formatScore(cfg: ExamPartConfig): string {
  if (cfg.count && cfg.score_per_item != null) {
    return `${cfg.count} câu, ${cfg.score_per_item}đ/câu`;
  }
  if (cfg.count && cfg.type === 'true_false') {
    return `${cfg.count} câu (điểm theo nhánh)`;
  }
  if (cfg.score != null) {
    return `${cfg.score} điểm`;
  }
  if (cfg.count) return `${cfg.count} câu`;
  return '';
}

export function getQuestionTypeVi(type: string): string {
  return QUESTION_TYPE_VI[type] ?? type;
}

export function getClusterSubtypeVi(subtype: string, count?: number): string {
  const base = CLUSTER_SUBTYPE_VI[subtype] ?? subtype;
  return count != null ? `${base} (${count} câu)` : base;
}

export function getPartLabelVi(subject: string, partKey: string): string {
  const structure = getDefaultStructure(subject);
  const cfg = structure?.parts[partKey];
  const num = partNumber(partKey);
  const typeLabel = cfg ? PART_TYPE_VI[cfg.type] ?? cfg.type : partKey;
  const score = cfg ? formatScore(cfg) : '';
  if (num > 0) {
    return score ? `Phần ${num} — ${typeLabel} (${score})` : `Phần ${num} — ${typeLabel}`;
  }
  return score ? `${typeLabel} (${score})` : typeLabel;
}

export function listPartOptionsVi(subject: string): { key: string; label: string; type: string }[] {
  const structure = getDefaultStructure(subject);
  if (!structure) return [];
  return Object.entries(structure.parts).map(([key, cfg]) => ({
    key,
    label: getPartLabelVi(subject, key),
    type: cfg.type,
  }));
}

export { CLUSTER_SUBTYPE_VI, QUESTION_TYPE_VI };

export type ComposerComposeMode = 'normal' | 'essay' | 'english';

export type SubjectStructureGroup =
  | 'math_3part'
  | 'science_3part'
  | 'social_2part'
  | 'informatics_2part'
  | 'literature_essay'
  | 'english_cluster';

const SCIENCE_SUBJECTS = new Set(['PHYSICS', 'CHEMISTRY', 'BIOLOGY', 'GEOGRAPHY']);
const SOCIAL_SUBJECTS = new Set(['HISTORY', 'CIVIC_EDU', 'TECH_INDUSTRY', 'TECH_AGRICULTURE', 'TECHNOLOGY']);

export function getComposeMode(subject: string): ComposerComposeMode {
  if (subject === 'ENGLISH') return 'english';
  if (subject === 'LITERATURE') return 'essay';
  return 'normal';
}

export function getComposeModeLabel(mode: ComposerComposeMode): string {
  if (mode === 'english') return 'Tiếng Anh (chùm)';
  if (mode === 'essay') return 'Tự luận';
  return 'Trắc nghiệm';
}

export function getSubjectStructureGroup(subject: string): SubjectStructureGroup {
  if (subject === 'ENGLISH') return 'english_cluster';
  if (subject === 'LITERATURE') return 'literature_essay';
  if (subject === 'MATH') return 'math_3part';
  if (SCIENCE_SUBJECTS.has(subject)) return 'science_3part';
  if (SOCIAL_SUBJECTS.has(subject)) return 'social_2part';
  if (subject === 'INFORMATICS') return 'informatics_2part';
  return 'social_2part';
}

export function getStructureMatrixBadge(subject: string): string {
  const group = getSubjectStructureGroup(subject);
  switch (group) {
    case 'math_3part': return '12+4+6';
    case 'science_3part': return '18+4+6';
    case 'social_2part': return '24+4';
    case 'informatics_2part': return '24+6 Đ/S';
    case 'literature_essay': return 'Đọc 4đ + Viết 6đ';
    case 'english_cluster': return '6 cluster · 40 câu';
    default: return '';
  }
}

export const TF_BRANCH_HINT = 'Đúng 1 ý: 0,1đ · 2 ý: 0,25đ · 3 ý: 0,5đ · 4 ý: 1,0đ';
