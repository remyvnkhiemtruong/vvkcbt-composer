import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getComposeMode,
  getComposeModeLabel,
  getStructureMatrixBadge,
  getSubjectStructureGroup,
} from './composer-labels';
import {
  createEmptyDraft,
  generateEnglishPaperFromClusters,
  getClusterProgress,
  ENGLISH_CLUSTER_ORDER,
} from './draft';
import type { ExamPackageExportState } from '@vnu/shared-types';

describe('compose mode routing', () => {
  it('routes ENGLISH to english mode', () => {
    assert.equal(getComposeMode('ENGLISH'), 'english');
    assert.equal(getComposeModeLabel('english'), 'Tiếng Anh (chùm)');
  });

  it('routes LITERATURE to essay mode', () => {
    assert.equal(getComposeMode('LITERATURE'), 'essay');
    assert.equal(getSubjectStructureGroup('LITERATURE'), 'literature_essay');
  });

  it('routes MATH to normal mode with matrix badge', () => {
    assert.equal(getComposeMode('MATH'), 'normal');
    assert.equal(getStructureMatrixBadge('MATH'), '12+4+6');
    assert.equal(getSubjectStructureGroup('PHYSICS'), 'science_3part');
    assert.equal(getStructureMatrixBadge('INFORMATICS'), '24+6 Đ/S');
  });
});

describe('generateEnglishPaperFromClusters', () => {
  it('orders questions by cluster subtype without shuffle', () => {
    const draft = createEmptyDraft();
    const clusterId = 'cl-test';
    const subtypes = [...ENGLISH_CLUSTER_ORDER];
    const counts: Record<string, number> = {
      fill_notice: 6,
      fill_flyer: 6,
      reorder: 5,
      fill_gap: 5,
      reading_8: 8,
      reading_10: 10,
    };
    const questions = subtypes.flatMap((subtype) => {
      const count = counts[subtype] ?? 0;
      return Array.from({ length: count }, (_, i) => ({
        id: `${subtype}-${i}`,
        subject: 'ENGLISH',
        type: 'cluster_mcq',
        part: 'part1_cluster_mcq',
        clusterId,
        clusterSubtype: subtype,
        clusterOrder: i + 1,
        content: { stem: `${subtype} q${i + 1}` },
        correctKey: 'A',
        maxScore: 0.25,
      }));
    });
  // reverse order in paper to test sort
    draft.papers.ENGLISH = {
      title: 'Anh',
      subject: 'ENGLISH',
      questions: [...questions].reverse() as never[],
      difficultyMeta: {},
    };
    draft.clusters = subtypes.map((subtype) => ({
      id: `cl-${subtype}`,
      subject: 'ENGLISH',
      clusterSubtype: subtype,
      passage: { text: 'passage' },
      questionIds: questions.filter((q) => q.clusterSubtype === subtype).map((q) => q.id),
    }));

    generateEnglishPaperFromClusters(draft);
    const ordered = (draft.papers.ENGLISH?.questions ?? []) as { clusterSubtype?: string; clusterOrder?: number }[];
    assert.equal(ordered.length, 40);
    assert.equal(ordered[0].clusterSubtype, 'fill_notice');
    assert.equal(ordered[ordered.length - 1].clusterSubtype, 'reading_10');
    assert.equal(ordered[ordered.length - 1].clusterOrder, 10);
  });
});

describe('getClusterProgress', () => {
  it('reports missing passage as not ok', () => {
    const draft = createEmptyDraft();
    draft.papers.ENGLISH = {
      title: 'Anh',
      subject: 'ENGLISH',
      questions: [{ id: 'q1', clusterSubtype: 'fill_notice', type: 'cluster_mcq' }] as never[],
      difficultyMeta: {},
    };
    const progress = getClusterProgress(draft);
    const notice = progress.find((p) => p.subtype === 'fill_notice');
    assert.ok(notice);
    assert.equal(notice.ok, false);
    assert.equal(notice.hasPassage, false);
  });
});
