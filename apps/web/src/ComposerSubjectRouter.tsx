import { useMemo, useState } from 'react';
import type { ExamPackageExportState, ExamPackageQuestionRow } from '@vnu/shared-types';
import { TN_THPT_SUBJECTS, getSubjectNameVi } from '@vnu/shared-types';
import {
  getComposeMode,
  getComposeModeLabel,
  getStructureMatrixBadge,
} from './composer-labels';
import { getClusterProgress } from './draft';
import { NormalSubjectEditor, NORMAL_SUBJECTS } from './NormalSubjectEditor';
import { LiteratureEditor } from './LiteratureEditor';
import { EnglishClusterEditor } from './EnglishClusterEditor';

export function ComposerSubjectRouter({
  draft,
  onDraftChange,
  onAdd,
  lockSubject,
}: {
  draft: ExamPackageExportState;
  onDraftChange: (fn: (d: ExamPackageExportState) => void) => void;
  onAdd: (q: ExamPackageQuestionRow) => void;
  lockSubject?: string;
}) {
  const enabledCodes = lockSubject
    ? [lockSubject]
    : draft.subjects.length
      ? draft.subjects.map((s) => s.code)
      : [...NORMAL_SUBJECTS, 'LITERATURE', 'ENGLISH'];

  const [subject, setSubject] = useState(lockSubject ?? enabledCodes[0] ?? 'MATH');
  const activeSubject = lockSubject ?? subject;
  const mode = getComposeMode(activeSubject);
  const modeLabel = getComposeModeLabel(mode);
  const matrixBadge = getStructureMatrixBadge(activeSubject);

  const clusterDone = useMemo(() => {
    if (mode !== 'english') return null;
    const p = getClusterProgress(draft);
    return `${p.filter((x) => x.ok).length}/6 cluster`;
  }, [draft, mode]);

  return (
    <div className="composer-subject-router">
      <div className="composer-mode-header">
        {!lockSubject && (
          <div className="composer-row">
            <label className="composer-field-label">Môn đang soạn</label>
            <select className="cbt-select" value={subject} onChange={(e) => setSubject(e.target.value)}>
              {enabledCodes.map((code) => {
                const meta = TN_THPT_SUBJECTS.find((s) => s.code === code);
                return <option key={code} value={code}>{meta?.nameVi ?? code}</option>;
              })}
            </select>
          </div>
        )}
        <div className="composer-mode-badges">
          <span className="composer-mode-badge">{modeLabel}</span>
          <span className="composer-mode-badge composer-mode-matrix">{matrixBadge}</span>
          {clusterDone && <span className="composer-mode-badge">{clusterDone}</span>}
        </div>
      </div>
      <p className="admin-hint">
        Đang soạn: <strong>{getSubjectNameVi(activeSubject)}</strong> — {modeLabel}
      </p>

      {mode === 'normal' && (
        <NormalSubjectEditor draft={draft} subject={activeSubject} onDraftChange={onDraftChange} onAdd={onAdd} />
      )}
      {mode === 'essay' && (
        <LiteratureEditor draft={draft} onDraftChange={onDraftChange} onAdd={onAdd} />
      )}
      {mode === 'english' && (
        <EnglishClusterEditor draft={draft} onChange={onDraftChange} />
      )}
    </div>
  );
}

export { getComposeMode } from './composer-labels';
