import { useState } from 'react';
import type { ExamPackageExportState } from '@vnu/shared-types';
import { TN_THPT_SUBJECTS, validateSubjectBlueprint } from '@vnu/shared-types';
import {
  addQuestion,
  credentialsReady,
  getComposerProgress,
  registerBrandingLogo,
} from './draft';
import { ComposerSubjectRouter } from './ComposerSubjectRouter';
import { PaperBuilder } from './PaperBuilder';
import { CredentialsPanel } from './CredentialsPanel';
import { SubjectSchedulePanel } from './SubjectSchedulePanel';
import { StudentRosterPanel } from './StudentRosterPanel';
import { ComposerToast } from './ComposerToast';
import { SubjectSetupBanner } from './SubjectSetupBanner';
import { SingleSubjectExportPanel } from './SingleSubjectExportPanel';
import type { ComposerUiState } from './draft';

const STEPS = [
  { id: 1, title: 'Cấu hình ca thi', short: 'Ca thi' },
  { id: 2, title: 'Chọn môn & lịch', short: 'Môn & lịch' },
  { id: 3, title: 'Danh sách thí sinh', short: 'Danh sách' },
  { id: 4, title: 'Soạn & ghép đề', short: 'Ra đề' },
  { id: 5, title: 'SBD & xuất USB', short: 'Xuất' },
] as const;

export function ComposerWizard({
  draft,
  onChange,
  onAddQuestion,
  onReset,
  ui,
  onUiChange,
}: {
  draft: ExamPackageExportState;
  onChange: (fn: (d: ExamPackageExportState) => void) => void;
  onAddQuestion: (q: Parameters<typeof addQuestion>[1]) => void;
  onReset?: () => void;
  ui: ComposerUiState;
  onUiChange: (fn: (u: ComposerUiState) => void) => void;
}) {
  const [step, setStep] = useState(1);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);
  const activeSubject = ui.activeSubject;
  const progress = getComposerProgress(draft, activeSubject);

  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ msg, type });
  };

  const activeProgress = activeSubject
    ? progress.subjects.find((s) => s.subjectCode === activeSubject)
    : progress.subjects[0];
  const canAdvanceFromStep4 = !!activeProgress?.blueprintOk;

  return (
    <div className="composer-wizard">
      <nav className="composer-wizard-steps" aria-label="Các bước soạn đề">
        {STEPS.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`composer-wizard-step ${step === s.id ? 'active' : ''} ${step > s.id ? 'done' : ''}`}
            onClick={() => setStep(s.id)}
          >
            <span className="composer-wizard-step-num">{s.id}</span>
            <span className="composer-wizard-step-label">{s.short}</span>
          </button>
        ))}
      </nav>

      <aside className="composer-wizard-sidebar">
        <h4>Tiến độ</h4>
        <ul className="composer-wizard-checklist">
          <li className={activeSubject ? 'ok' : ''}>
            {activeSubject ? '✓' : '○'} Môn: {activeSubject ? TN_THPT_SUBJECTS.find((x) => x.code === activeSubject)?.nameVi : 'chưa chọn'}
          </li>
          <li className={draft.students.some((st) => !activeSubject || st.subjects.includes(activeSubject)) ? 'ok' : ''}>
            {draft.students.some((st) => !activeSubject || st.subjects.includes(activeSubject)) ? '✓' : '○'}{' '}
            Thí sinh môn này
          </li>
          <li className={activeProgress?.blueprintOk ? 'ok' : ''}>
            {activeProgress?.blueprintOk ? '✓' : '○'} Đề QĐ764
          </li>
          <li className={credentialsReady(draft, activeSubject, ui).ok ? 'ok' : ''}>
            {credentialsReady(draft, activeSubject, ui).ok ? '✓' : '○'} SBD & phiếu
          </li>
          <li className={activeSubject && ui.sealedExports[activeSubject] ? 'ok' : ''}>
            {activeSubject && ui.sealedExports[activeSubject] ? '✓' : '○'} USB đã xuất
          </li>
        </ul>
        {activeSubject && progress.subjects.filter((s) => s.subjectCode === activeSubject).map((s) => (
          <div key={s.subjectCode} className="composer-wizard-subject">
            <strong>{TN_THPT_SUBJECTS.find((x) => x.code === s.subjectCode)?.nameVi ?? s.subjectCode}</strong>
            <span className={s.blueprintOk ? 'composer-check-ok-text' : 'composer-check-fail-text'}>
              {s.blueprintOk ? ' ✓' : ` ${s.questionCount} câu`}
            </span>
          </div>
        ))}
      </aside>

      <div className="composer-wizard-body">
        <SubjectSetupBanner
          draft={draft}
          ui={ui}
          onUiChange={onUiChange}
          onDraftChange={onChange}
          compact
        />
        {step === 1 && (
          <div className="composer-panel">
            <h3>Bước 1 — Cấu hình ca thi</h3>
            <p className="admin-hint">Tên kỳ, GK/CK, branding — dùng chung cho mọi USB môn (cùng packageId).</p>
            <div className="composer-row">
              <label>Tên kỳ thi</label>
              <input
                className="cbt-input"
                value={draft.session.name}
                onChange={(e) =>
                  onChange((d) => {
                    d.session.name = e.target.value;
                    d.manifest.examName = e.target.value;
                  })
                }
              />
            </div>
            <div className="composer-row">
              <label>Loại kỳ</label>
              <select
                className="cbt-input"
                value={draft.session.rules.assessment_period ?? 'GK2'}
                onChange={(e) =>
                  onChange((d) => {
                    const period = e.target.value as 'GK1' | 'GK2' | 'CK1' | 'CK2';
                    d.session.rules.assessment_period = period;
                    d.session.rules.exam_type = 'GDPT_2018';
                  })
                }
              >
                <option value="GK1">Giữa kỳ 1</option>
                <option value="GK2">Giữa kỳ 2</option>
                <option value="CK1">Cuối kỳ 1</option>
                <option value="CK2">Cuối kỳ 2 / Mock TN</option>
              </select>
            </div>
            <div className="composer-row">
              <label>Sở GDĐT</label>
              <input
                className="cbt-input"
                value={draft.manifest.branding?.soGdName ?? ''}
                placeholder="SỞ GDĐT CÀ MAU"
                onChange={(e) =>
                  onChange((d) => {
                    if (!d.manifest.branding) d.manifest.branding = {};
                    d.manifest.branding.soGdName = e.target.value;
                  })
                }
              />
            </div>
            <div className="composer-row">
              <label>Tên trường</label>
              <input
                className="cbt-input"
                value={draft.manifest.branding?.schoolName ?? ''}
                placeholder="TRƯỜNG THPT VÕ VĂN KIỆT"
                onChange={(e) =>
                  onChange((d) => {
                    if (!d.manifest.branding) d.manifest.branding = {};
                    d.manifest.branding.schoolName = e.target.value;
                  })
                }
              />
            </div>
            <div className="composer-row">
              <label>Logo trường</label>
              <input
                type="file"
                accept="image/png,image/jpeg"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const next = structuredClone(draft);
                  await registerBrandingLogo(next, file);
                  onChange((d) => {
                    d.manifest = next.manifest;
                    d.mediaFiles = next.mediaFiles;
                  });
                  showToast('Đã cập nhật logo', 'success');
                  e.target.value = '';
                }}
              />
            </div>
            <p className="admin-hint">Package ID: <code>{draft.manifest.packageId}</code></p>
            <button
              type="button"
              className="cbt-btn cbt-btn-outline"
              style={{ marginTop: '1rem' }}
              onClick={() => setShowAdvanced((v) => !v)}
            >
              {showAdvanced ? '▲ Thu gọn Nâng cao' : '▼ Nâng cao — giám sát & blueprint'}
            </button>
            {showAdvanced && (
              <div style={{ marginTop: '1rem' }}>
                <div className="composer-row" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
                  {(
                    [
                      ['require_fullscreen', 'Bắt buộc fullscreen'],
                      ['block_copy_paste', 'Chặn copy/dán'],
                      ['block_context_menu', 'Chặn menu chuột phải'],
                      ['watermark', 'Watermark SBD/tài khoản'],
                      ['single_active_session', '1 phiên / tài khoản'],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key} style={{ fontSize: '0.85rem' }}>
                      <input
                        type="checkbox"
                        checked={draft.session.rules.proctoring[key] !== false}
                        onChange={(e) =>
                          onChange((d) => {
                            (d.session.rules.proctoring as Record<string, boolean>)[key] = e.target.checked;
                          })
                        }
                      />{' '}
                      {label}
                    </label>
                  ))}
                </div>
                <div style={{ marginTop: '1.5rem' }}>
                  <h4>Blueprint — trạng thái 11 môn</h4>
                  <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th align="left">Môn</th>
                        <th align="left">Câu</th>
                        <th align="left">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      {TN_THPT_SUBJECTS.map((s) => {
                        const paper = draft.papers[s.code];
                        const bp = paper?.questions?.length
                          ? validateSubjectBlueprint({
                              subjectCode: s.code,
                              paper,
                              clusters: draft.clusters,
                              mediaManifest: draft.manifest.mediaManifest,
                            })
                          : { valid: false, errors: ['Chưa có đề'] };
                        return (
                          <tr key={s.code}>
                            <td>{s.nameVi}</td>
                            <td>{paper?.questions?.length ?? 0}</td>
                            <td style={{ color: bp.valid ? '#15803d' : '#b91c1c' }}>
                              {bp.valid ? 'Sẵn sàng' : bp.errors.join(' · ')}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="composer-panel">
            <h3>Bước 2 — Chọn môn & lịch khung giờ</h3>
            <SubjectSchedulePanel
              draft={draft}
              onChange={onChange}
              activeSubject={activeSubject}
              singleSubjectMode
            />
          </div>
        )}

        {step === 3 && (
          <div className="composer-panel">
            <h3>Bước 3 — Danh sách thí sinh</h3>
            <StudentRosterPanel
              draft={draft}
              onChange={onChange}
              onToast={showToast}
              activeSubject={activeSubject}
              onUiChange={(fn) => onUiChange((u) => fn(u))}
            />
          </div>
        )}

        {step === 4 && (
          <div>
            <h3>Bước 4 — Soạn câu & ghép đề</h3>
            {!activeSubject && (
              <p className="composer-wizard-warn">Chọn môn đang setup ở banner phía trên.</p>
            )}
            {!canAdvanceFromStep4 && activeSubject && (
              <p className="composer-wizard-warn">
                Chưa đạt blueprint môn này. Sinh đề hoặc bấm Bỏ qua để sửa sau.
              </p>
            )}
            <ComposerSubjectRouter
              draft={draft}
              onDraftChange={onChange}
              onAdd={onAddQuestion}
              lockSubject={activeSubject}
            />
            <PaperBuilder draft={draft} onChange={onChange} lockSubject={activeSubject} />
          </div>
        )}

        {step === 5 && (
          <div>
            <CredentialsPanel
              draft={draft}
              onChange={onChange}
              onToast={showToast}
              activeSubject={activeSubject}
              onUiChange={onUiChange}
              printedSubjects={ui.printedSubjects}
            />
            <SingleSubjectExportPanel
              draft={draft}
              activeSubject={activeSubject}
              ui={ui}
              onUiChange={onUiChange}
              onDraftChange={onChange}
              onToast={showToast}
              onSetupNextSubject={() => {
                onUiChange((u) => {
                  u.activeSubject = undefined;
                });
                setStep(2);
                showToast('Chọn môn tiếp theo để setup USB mới', 'info');
              }}
            />
            <button
              type="button"
              className="cbt-btn cbt-btn-outline"
              style={{ marginTop: '1rem' }}
              onClick={() => {
                if (window.confirm('Tạo gói mới? Dữ liệu hiện tại sẽ bị xóa.')) {
                  onReset?.();
                  setStep(1);
                  showToast('Đã tạo gói mới', 'info');
                }
              }}
            >
              Tạo ca thi mới
            </button>
          </div>
        )}

        <div className="composer-wizard-nav">
          <button type="button" className="cbt-btn cbt-btn-outline" disabled={step <= 1} onClick={() => setStep((s) => s - 1)}>
            Quay lại
          </button>
          {step === 4 && !canAdvanceFromStep4 && (
            <button type="button" className="cbt-btn cbt-btn-outline" onClick={() => setStep(5)}>
              Bỏ qua — sửa sau
            </button>
          )}
          <button
            type="button"
            className="cbt-btn cbt-btn-primary"
            disabled={
              step >= 5 ||
              (step === 2 && !activeSubject) ||
              (step === 4 && !canAdvanceFromStep4)
            }
            onClick={() => setStep((s) => Math.min(5, s + 1))}
          >
            Tiếp
          </button>
        </div>
      </div>

      {toast && <ComposerToast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
