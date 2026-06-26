import { TN_THPT_SUBJECTS } from '@vnu/shared-types';
import type { ExamPackageExportState } from '@vnu/shared-types';
import {
  type ComposerUiState,
  type TnThptSubjectCode,
  ensureSubjectInSchedule,
  getSubjectSetupStatus,
} from './draft';

const STATUS_LABEL: Record<string, string> = {
  sealed: 'Đã xuất USB',
  in_progress: 'Đang soạn',
  not_started: 'Chưa setup',
};

export function SubjectSetupBanner({
  draft,
  ui,
  onUiChange,
  onDraftChange,
  compact,
}: {
  draft: ExamPackageExportState;
  ui: ComposerUiState;
  onUiChange: (fn: (u: ComposerUiState) => void) => void;
  onDraftChange: (fn: (d: ExamPackageExportState) => void) => void;
  compact?: boolean;
}) {
  const active = ui.activeSubject;

  const pickSubject = (code: TnThptSubjectCode) => {
    const prev = ui.activeSubject;
    const prevStatus = prev ? getSubjectSetupStatus(draft, prev, ui) : null;
    if (prev && prev !== code && prevStatus === 'in_progress') {
      if (!window.confirm(`Đang soạn ${TN_THPT_SUBJECTS.find((s) => s.code === prev)?.nameVi}. Chuyển sang môn khác?`)) {
        return;
      }
    }
    onUiChange((u) => {
      u.activeSubject = code;
    });
    onDraftChange((d) => ensureSubjectInSchedule(d, code));
  };

  return (
    <div className="subject-setup-banner" style={{ marginBottom: compact ? '0.75rem' : '1rem' }}>
      <div className="composer-row" style={{ alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <label className="composer-field-label" style={{ marginBottom: 0 }}>
          Môn đang setup
        </label>
        <select
          className="cbt-select"
          value={active ?? ''}
          onChange={(e) => {
            const code = e.target.value as TnThptSubjectCode;
            if (code) pickSubject(code);
          }}
        >
          <option value="">— Chọn môn —</option>
          {TN_THPT_SUBJECTS.map((s) => (
            <option key={s.code} value={s.code}>
              {s.nameVi}
            </option>
          ))}
        </select>
        {active && (
          <span
            className="composer-mode-badge"
            title={STATUS_LABEL[getSubjectSetupStatus(draft, active, ui)]}
          >
            {STATUS_LABEL[getSubjectSetupStatus(draft, active, ui)]}
          </span>
        )}
        <span className="admin-hint" style={{ margin: 0 }}>
          Ca: <code>{draft.manifest.packageId.slice(0, 8)}…</code>
          {draft.session.rules.assessment_period && (
            <> · {draft.session.rules.assessment_period}</>
          )}
        </span>
      </div>
      {!compact && (
        <p className="admin-hint" style={{ marginTop: '0.35rem' }}>
          Mỗi USB niêm phong chỉ chứa <strong>một môn</strong>. Hoàn tất setup → xuất ZIP → lặp môn tiếp theo.
        </p>
      )}
      {Object.keys(ui.sealedExports).length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.35rem' }}>
          {Object.entries(ui.sealedExports).map(([code, rec]) => {
            const name = TN_THPT_SUBJECTS.find((s) => s.code === code)?.nameVi ?? code;
            return (
              <span key={code} className="composer-mode-badge" style={{ background: '#166534', color: '#fff' }}>
                ✓ {name}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
