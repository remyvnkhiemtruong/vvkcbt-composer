import { useState } from 'react';
import { TN_THPT_SUBJECTS } from '@vnu/shared-types';
import type { ExamPackageExportState } from '@vnu/shared-types';
import {
  credentialsReady,
  type ComposerUiState,
  saveComposerUi,
  syncCredentialsPrintedAt,
} from './draft';
import { validatePackage, exportPackage, exportPackagesBySubject, exportPackageSubject, downloadBlob } from './api';

export function SingleSubjectExportPanel({
  draft,
  activeSubject,
  ui,
  onUiChange,
  onDraftChange,
  onToast,
  onSetupNextSubject,
}: {
  draft: ExamPackageExportState;
  activeSubject?: string;
  ui: ComposerUiState;
  onUiChange: (fn: (u: ComposerUiState) => void) => void;
  onDraftChange: (fn: (d: ExamPackageExportState) => void) => void;
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onSetupNextSubject?: () => void;
}) {
  const [validateMsg, setValidateMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const meta = activeSubject ? TN_THPT_SUBJECTS.find((s) => s.code === activeSubject) : undefined;
  const schedule = activeSubject ? draft.subjects.find((s) => s.code === activeSubject) : undefined;
  const studentCount = activeSubject
    ? draft.students.filter((st) => st.subjects.includes(activeSubject)).length
    : 0;
  const credOk = activeSubject
    ? credentialsReady(draft, activeSubject, ui)
    : { ok: false, errors: [] };

  const runValidate = async () => {
    if (!activeSubject) {
      setValidateMsg('Chọn môn đang setup trước');
      return;
    }
    setBusy(true);
    try {
      const r = await validatePackage(draft, activeSubject);
      setValidateMsg(
        r.valid
          ? `OK — sẵn sàng xuất USB ${meta?.nameVi ?? activeSubject}`
          : r.errors.join('\n') + (r.warnings.length ? `\n⚠ ${r.warnings.join('; ')}` : ''),
      );
    } catch (e) {
      setValidateMsg(e instanceof Error ? e.message : 'Lỗi validate');
    } finally {
      setBusy(false);
    }
  };

  const runExport = async () => {
    if (!activeSubject) {
      onToast('Chọn môn đang setup trước', 'error');
      return;
    }
    if (!credOk.ok) {
      onToast(credOk.errors[0] ?? 'Chưa đủ điều kiện xuất', 'error');
      return;
    }
    const ok = window.confirm(
      `Xuất USB môn ${meta?.nameVi ?? activeSubject}?\n\n` +
        'Chỉ copy file ZIP này lên một USB. Niêm phong — không chia sẻ đề trước giờ thi.',
    );
    if (!ok) return;
    setBusy(true);
    try {
      onDraftChange((d) => {
        d.manifest.createdAt = new Date().toISOString();
      });
      const filename = await exportPackageSubject(draft, activeSubject);
      onUiChange((u) => {
        u.sealedExports[activeSubject] = { at: new Date().toISOString(), filename };
      });
      saveComposerUi({
        ...ui,
        sealedExports: { ...ui.sealedExports, [activeSubject]: { at: new Date().toISOString(), filename } },
      });
      onToast(`Đã xuất ${filename} — copy lên USB và niêm phong`, 'success');
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Xuất thất bại', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="composer-panel">
      <h3>Xuất USB — một môn</h3>
      {!activeSubject ? (
        <p className="admin-hint">Chọn môn ở banner phía trên để kiểm tra và xuất ZIP.</p>
      ) : (
        <>
          <ul className="admin-hint" style={{ lineHeight: 1.6 }}>
            <li>
              <strong>{meta?.nameVi}</strong>
              {schedule && (
                <>
                  {' '}
                  · {schedule.examDate} {schedule.startTime}–{schedule.endTime} ({schedule.durationMin}′)
                </>
              )}
            </li>
            <li>{studentCount} thí sinh · credentials {credOk.ok ? '✓' : '○'}</li>
            <li>packageId: {draft.manifest.packageId}</li>
          </ul>
          {validateMsg && (
            <pre className="composer-validate-msg" style={{ whiteSpace: 'pre-wrap', fontSize: '0.85rem' }}>
              {validateMsg}
            </pre>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.75rem' }}>
            <button type="button" className="cbt-btn cbt-btn-outline" disabled={busy} onClick={runValidate}>
              Kiểm tra trước xuất
            </button>
            <button
              type="button"
              className="cbt-btn cbt-btn-primary"
              disabled={busy || !credOk.ok}
              onClick={runExport}
            >
              Xuất USB — {meta?.nameVi}
            </button>
            {onSetupNextSubject && ui.sealedExports[activeSubject] && (
              <button type="button" className="cbt-btn cbt-btn-outline" onClick={onSetupNextSubject}>
                Setup môn tiếp theo
              </button>
            )}
          </div>
        </>
      )}

      <details style={{ marginTop: '1.25rem' }}>
        <summary className="admin-hint" style={{ cursor: 'pointer', color: '#b45309' }}>
          Nâng cao — không dùng ngày thi (nguy cơ lộ đề)
        </summary>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
          <button
            type="button"
            className="cbt-btn cbt-btn-outline"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await downloadBlob('/composer/packages/template', 'exam-package-mau.zip');
              } catch (e) {
                onToast(e instanceof Error ? e.message : 'Lỗi tải mẫu', 'error');
              } finally {
                setBusy(false);
              }
            }}
          >
            Tải file ZIP mẫu
          </button>
          <button
            type="button"
            className="cbt-btn cbt-btn-outline"
            disabled={busy || !credentialsReady(draft, activeSubject, ui).ok}
            onClick={async () => {
              setBusy(true);
              try {
                onDraftChange((d) => {
                  d.manifest.createdAt = new Date().toISOString();
                });
                await exportPackage(draft);
                onToast('Đã xuất gói thi (tất cả môn)', 'success');
              } catch (e) {
                onToast(e instanceof Error ? e.message : 'Xuất thất bại', 'error');
              } finally {
                setBusy(false);
              }
            }}
          >
            Xuất gói kỳ thi (1 ZIP tất cả môn)
          </button>
          <button
            type="button"
            className="cbt-btn cbt-btn-outline"
            disabled={busy || !credentialsReady(draft, activeSubject, ui).ok}
            onClick={async () => {
              setBusy(true);
              try {
                onDraftChange((d) => {
                  d.manifest.createdAt = new Date().toISOString();
                });
                const n = await exportPackagesBySubject(draft);
                onToast(`Đã xuất ${n} file ZIP (mỗi môn một file)`, 'success');
              } catch (e) {
                onToast(e instanceof Error ? e.message : 'Xuất từng môn thất bại', 'error');
              } finally {
                setBusy(false);
              }
            }}
          >
            Xuất ZIP từng môn (tất cả)
          </button>
        </div>
      </details>
    </div>
  );
}
