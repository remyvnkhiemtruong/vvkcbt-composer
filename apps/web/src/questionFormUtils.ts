import { getDefaultStructure } from '@vnu/shared-types';

export function defaultMaxScore(subject: string, type: string, part?: string): number {
  const structure = getDefaultStructure(subject);
  if (!structure || !part) {
    if (type === 'mcq' || type === 'cluster_mcq') return 0.25;
    if (type === 'true_false') return subject === 'INFORMATICS' ? 4 / 6 : 1;
    if (type === 'short_answer') return subject === 'MATH' ? 0.5 : 0.25;
    if (type === 'essay' && part === 'part1_reading') return 4;
    if (type === 'essay' && part === 'part2_writing') return 6;
    return 0.25;
  }
  const cfg = structure.parts[part];
  if (!cfg) return 0.25;
  if (cfg.type === 'mcq' || cfg.type === 'short_answer' || cfg.type === 'cluster_mcq') {
    return cfg.score_per_item ?? 0.25;
  }
  if (cfg.type === 'true_false') return subject === 'INFORMATICS' ? 4 / 6 : 1;
  if (cfg.type === 'essay') return cfg.score ?? (part === 'part1_reading' ? 4 : 6);
  return 0.25;
}
