import { useMemo, useState } from 'react';
import { TN_THPT_SUBJECTS, TNPT_36_COMBOS } from '@vnu/shared-types';
import type { ExamPackageExportState } from '@vnu/shared-types';
import type { ExamPackageStudentRow } from './draft';
import { parseStudentsExcel, buildStudentTemplateExcel } from './excelImport';
import type { ToastType } from './ComposerToast';

const SUBJECT_VI = Object.fromEntries(TN_THPT_SUBJECTS.map((s) => [s.code, s.nameVi]));

function subjectBadges(subjects: string[]) {
  return subjects.map((code) => (
    <span key={code} className="roster-subject-badge" title={SUBJECT_VI[code] ?? code}>
      {SUBJECT_VI[code]?.charAt(0) ?? code.slice(0, 1)}
    </span>
  ));
}

function analyzeImport(rows: ExamPackageStudentRow[]) {
  const warnings: string[] = [];
  const sbds = rows.map((r) => r.sbd?.trim()).filter(Boolean) as string[];
  const dupSbd = [...new Set(sbds.filter((s, i) => sbds.indexOf(s) !== i))];
  if (dupSbd.length) warnings.push(`SBD trùng: ${dupSbd.join(', ')}`);
  const noSubjects = rows.filter((r) => !r.subjects.length).length;
  if (noSubjects) warnings.push(`${noSubjects} dòng không có môn — sẽ gán Văn+Toán`);
  return warnings;
}

export function StudentRosterPanel({
  draft,
  onChange,
  onToast,
  activeSubject,
  onUiChange,
}: {
  draft: ExamPackageExportState;
  onChange: (fn: (d: ExamPackageExportState) => void) => void;
  onToast?: (msg: string, type?: ToastType) => void;
  activeSubject?: string;
  onUiChange?: (fn: (u: { printedSubjects: Record<string, string> }) => void) => void;
}) {
  const [preview, setPreview] = useState<{
    rows: ExamPackageStudentRow[];
    warnings: string[];
    fileName: string;
  } | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const comboTarget = selectedIdx ?? (draft.students.length ? draft.students.length - 1 : null);

  const invalidateCredentials = () => {
    onUiChange?.((u) => {
      if (activeSubject) {
        const next = { ...u.printedSubjects };
        delete next[activeSubject];
        u.printedSubjects = next;
      } else {
        u.printedSubjects = {};
      }
    });
  };

  const applyImport = (rows: ExamPackageStudentRow[]) => {
    const filtered = activeSubject
      ? rows
          .filter((r) => r.subjects.includes(activeSubject))
          .map((r) => ({ ...r, subjects: [...new Set([activeSubject, ...r.subjects])] }))
      : rows;
    if (activeSubject && !filtered.length) {
      onToast?.(`Không có thí sinh nào đăng ký môn ${SUBJECT_VI[activeSubject] ?? activeSubject} trong file`, 'error');
      return;
    }
    const hasCreds = activeSubject
      ? (draft.credentials ?? []).some((c) => c.subjectCode === activeSubject)
      : (draft.credentials?.length ?? 0) > 0 || !!draft.credentialsAssignedAt;
    const doImport = () => {
      onChange((d) => {
        const map = new Map<string, ExamPackageStudentRow>();
        for (const st of d.students) {
          map.set(st.sbd?.trim() || st.studentCode, { ...st });
        }
        for (const row of filtered) {
          const key = row.sbd?.trim() || row.studentCode;
          const prev = map.get(key);
          if (prev) {
            const subjects = new Set([...prev.subjects, ...row.subjects]);
            map.set(key, { ...prev, ...row, subjects: [...subjects] });
          } else {
            map.set(key, { ...row });
          }
        }
        d.students = [...map.values()];
        if (activeSubject) {
          d.credentials = (d.credentials ?? []).filter((c) => c.subjectCode !== activeSubject);
        } else {
          d.credentials = [];
          d.credentialsAssignedAt = undefined;
          d.credentialsPrintedAt = undefined;
        }
        invalidateCredentials();
      });
      onToast?.(`Đã import ${filtered.length} thí sinh${activeSubject ? ` (môn ${SUBJECT_VI[activeSubject]})` : ''}`, 'success');
      setPreview(null);
    };
    if (hasCreds) {
      if (window.confirm('Import sẽ xóa SBD/tài khoản môn này đã gán. Tiếp tục?')) doImport();
    } else {
      doImport();
    }
  };

  const handleFile = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      let rows = parseStudentsExcel(buf);
      if (activeSubject) {
        rows = rows.filter((r) => r.subjects.includes(activeSubject));
      }
      if (!rows.length) {
        onToast?.('Không đọc được dòng thí sinh hợp lệ', 'error');
        return;
      }
      setPreview({ rows, warnings: analyzeImport(rows), fileName: file.name });
    } catch (err) {
      onToast?.(err instanceof Error ? err.message : 'Import thất bại', 'error');
    }
  };

  const tableRows = useMemo(() => {
    if (!activeSubject) return draft.students;
    return draft.students.filter((st) => st.subjects.includes(activeSubject));
  }, [draft.students, activeSubject]);

  return (
    <div className="student-roster-panel">
      <p className="admin-hint">
        Import Excel: <strong>Họ tên, SBD, Lớp, Ngày sinh, Giới tính</strong> + đánh dấu <strong>X</strong> ở cột môn.
        {activeSubject && (
          <>
            {' '}
            Chỉ lấy thí sinh có môn <strong>{SUBJECT_VI[activeSubject]}</strong>.
          </>
        )}
      </p>
      <div className="composer-row" style={{ marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <select
          className="cbt-select"
          value=""
          disabled={!activeSubject && comboTarget === null}
          onChange={(e) => {
            const combo = TNPT_36_COMBOS.find((c) => c.comboCode === e.target.value);
            if (!combo || comboTarget === null) return;
            const name = draft.students[comboTarget]?.fullName ?? 'HS';
            onChange((d) => {
              d.students[comboTarget].comboCode = combo.comboCode;
              d.students[comboTarget].subjects = [...combo.subjects];
            });
            onToast?.(`Đã gán ${combo.comboCode} cho ${name}`, 'info');
            e.target.value = '';
          }}
        >
          <option value="">Gán tổ hợp TNPT 36...</option>
          {TNPT_36_COMBOS.map((c) => (
            <option key={c.comboCode} value={c.comboCode}>
              {c.comboCode} — {c.comboName}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="cbt-btn cbt-btn-outline"
          onClick={() => {
            const blob = buildStudentTemplateExcel();
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'mau-danh-sach-thi-sinh.xlsx';
            a.click();
          }}
        >
          Tải mẫu Excel
        </button>
        <label className="cbt-btn cbt-btn-primary" style={{ cursor: 'pointer' }}>
          Import Excel
          <input
            type="file"
            accept=".xlsx,.xls"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
              e.target.value = '';
            }}
          />
        </label>
        <button
          type="button"
          className="cbt-btn cbt-btn-outline"
          onClick={() =>
            onChange((d) => {
              d.students.push({
                fullName: 'Thí sinh mới',
                studentCode: `HS${String(d.students.length + 1).padStart(3, '0')}`,
                className: '12A1',
                subjects: activeSubject ? [activeSubject] : ['LITERATURE', 'MATH'],
              });
            })
          }
        >
          + Thí sinh
        </button>
      </div>

      {tableRows.length > 0 ? (
        <table className="cbt-table roster-table">
          <thead>
            <tr>
              <th>Họ tên</th>
              <th>SBD</th>
              <th>Lớp</th>
              <th>Ngày sinh</th>
              <th>GT</th>
              <th>Môn</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {tableRows.map((st) => {
              const idx = draft.students.findIndex(
                (s) => s.studentCode === st.studentCode && (s.sbd ?? '') === (st.sbd ?? ''),
              );
              if (idx < 0) return null;
              return (
              <tr
                key={`${st.studentCode}-${idx}`}
                className={selectedIdx === idx ? 'roster-row-selected' : ''}
                onClick={() => setSelectedIdx(idx)}
              >
                <td>
                  <input
                    className="cbt-input roster-input"
                    value={st.fullName}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => onChange((d) => { d.students[idx].fullName = e.target.value; })}
                  />
                </td>
                <td>
                  <input
                    className="cbt-input roster-input roster-input--narrow"
                    value={st.sbd ?? ''}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => onChange((d) => { d.students[idx].sbd = e.target.value; })}
                  />
                </td>
                <td>
                  <input
                    className="cbt-input roster-input roster-input--narrow"
                    value={st.className ?? ''}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => onChange((d) => { d.students[idx].className = e.target.value; })}
                  />
                </td>
                <td>
                  <input
                    className="cbt-input roster-input roster-input--narrow"
                    value={st.dateOfBirth ?? ''}
                    placeholder="dd/mm/yyyy"
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => onChange((d) => { d.students[idx].dateOfBirth = e.target.value; })}
                  />
                </td>
                <td>
                  <input
                    className="cbt-input roster-input roster-input--narrow"
                    value={st.gender ?? ''}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => onChange((d) => { d.students[idx].gender = e.target.value; })}
                  />
                </td>
                <td className="roster-subjects-cell">{subjectBadges(st.subjects)}</td>
                <td>
                  <button
                    type="button"
                    className="cbt-btn cbt-btn-outline roster-delete-btn"
                    title="Xóa thí sinh"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!window.confirm(`Xóa ${st.fullName}?`)) return;
                      onChange((d) => {
                        d.students.splice(idx, 1);
                        d.credentials = [];
                        d.credentialsAssignedAt = undefined;
                        d.credentialsPrintedAt = undefined;
                        invalidateCredentials();
                      });
                      setSelectedIdx(null);
                    }}
                  >
                    ✕
                  </button>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <p className="admin-hint">Chưa có thí sinh — tải mẫu Excel hoặc thêm tay.</p>
      )}

      {preview && (
        <div className="roster-import-modal" role="dialog" aria-modal="true">
          <div className="roster-import-dialog">
            <h3>Xem trước import — {preview.fileName}</h3>
            <p>
              <strong>{preview.rows.length}</strong> dòng hợp lệ
            </p>
            {preview.warnings.length > 0 && (
              <ul className="roster-import-warnings">
                {preview.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            )}
            <table className="cbt-table" style={{ fontSize: '0.85rem', maxHeight: 240, display: 'block', overflow: 'auto' }}>
              <thead>
                <tr>
                  <th>Họ tên</th>
                  <th>SBD</th>
                  <th>Lớp</th>
                  <th>Môn</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, 20).map((r, i) => (
                  <tr key={`${r.studentCode}-${i}`}>
                    <td>{r.fullName}</td>
                    <td>{r.sbd ?? '—'}</td>
                    <td>{r.className ?? '—'}</td>
                    <td>{r.subjects.map((c) => SUBJECT_VI[c] ?? c).join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.rows.length > 20 && (
              <p className="admin-hint">… và {preview.rows.length - 20} dòng khác</p>
            )}
            <div className="composer-row" style={{ marginTop: '1rem' }}>
              <button type="button" className="cbt-btn cbt-btn-primary" onClick={() => applyImport(preview.rows)}>
                Xác nhận import
              </button>
              <button type="button" className="cbt-btn cbt-btn-outline" onClick={() => setPreview(null)}>
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
