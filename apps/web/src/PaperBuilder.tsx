import { useMemo, useState } from 'react';
import type { ExamPackageExportState } from '@vnu/shared-types';
import { TN_THPT_SUBJECTS, getDefaultStructure, validateSubjectBlueprint } from '@vnu/shared-types';
import { getComposeMode, getClusterSubtypeVi, getPartLabelVi } from './composer-labels';
import { ComposerToast } from './ComposerToast';
import {
  rebuildPaperFromQuestions,
  generatePaperFromBank,
  getQd764QuestionCount,
  getClusterProgress,
  listQuestions,
} from './draft';

export function PaperBuilder({
  draft,
  onChange,
  lockSubject,
}: {
  draft: ExamPackageExportState;
  onChange: (fn: (d: ExamPackageExportState) => void) => void;
  lockSubject?: string;
}) {
  const enabledSubjects = lockSubject
    ? [lockSubject]
    : draft.subjects.map((s) => s.code);
  const [subject, setSubject] = useState(lockSubject ?? enabledSubjects[0] ?? 'MATH');
  const activeSubject = lockSubject ?? subject;
  const [selected, setSelected] = useState<string[]>([]);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);

  const qd764Count = getQd764QuestionCount(activeSubject);
  const structure = getDefaultStructure(activeSubject);
  const composeMode = getComposeMode(activeSubject);

  const pool = useMemo(() => {
    return listQuestions(draft, activeSubject).map((q) => ({
      id: q.id,
      stem: String((q.content as { stem?: string })?.stem ?? '').slice(0, 80),
    }));
  }, [draft, activeSubject]);

  const partChecklist = useMemo(() => {
    if (composeMode === 'english') {
      return getClusterProgress(draft).map((p) => ({
        partKey: p.subtype,
        label: getClusterSubtypeVi(p.subtype, p.expected),
        count: p.actual,
        expected: p.expected,
        ok: p.ok,
        extra: p.hasPassage ? '' : ' (thiếu passage)',
      }));
    }
    const paper = draft.papers[activeSubject];
    const qs = (paper?.questions ?? []) as { part?: string; type?: string }[];
    if (!structure) return [];
    return Object.entries(structure.parts).map(([partKey, cfg]) => {
      const count = qs.filter((q) => q.part === partKey || (!q.part && q.type === cfg.type)).length;
      const expected = cfg.count ?? (cfg.type === 'essay' ? 1 : 0);
      return {
        partKey,
        label: getPartLabelVi(activeSubject, partKey),
        count,
        expected,
        ok: count === expected,
        extra: '',
      };
    });
  }, [composeMode, draft, structure, activeSubject]);

  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ msg, type });
  };

  const generateOne = () => {
    onChange((d) => generatePaperFromBank(d, activeSubject));
    const hint = composeMode === 'english'
      ? ' (ghép 6 cluster theo thứ tự QĐ764)'
      : composeMode === 'essay'
        ? ' (2 bài tự luận)'
        : '';
    showToast(`Đã sinh đề ${TN_THPT_SUBJECTS.find((s) => s.code === activeSubject)?.nameVi ?? activeSubject}${hint}`, 'success');
  };

  const generateAll = () => {
    if (lockSubject) {
      generateOne();
      return;
    }
    let count = 0;
    onChange((d) => {
      for (const code of enabledSubjects) {
        generatePaperFromBank(d, code);
        count++;
      }
    });
    showToast(`Đã sinh đề cho ${count} môn`, 'success');
  };

  const applyManual = () => {
    if (composeMode === 'english') {
      showToast('Môn Anh dùng cluster — không hỗ trợ chọn thủ công', 'error');
      return;
    }
    onChange((d) => rebuildPaperFromQuestions(d, activeSubject, selected));
    showToast(`Đã ghép ${selected.length} câu cho ${activeSubject}`, 'success');
  };

  return (
    <div className="composer-panel">
      <div className="composer-row">
        {!lockSubject ? (
          <select className="cbt-select" value={subject} onChange={(e) => { setSubject(e.target.value); setSelected([]); }}>
            {enabledSubjects.map((code) => {
              const s = TN_THPT_SUBJECTS.find((x) => x.code === code);
              return (
                <option key={code} value={code}>{s?.nameVi ?? code}</option>
              );
            })}
          </select>
        ) : (
          <strong>{TN_THPT_SUBJECTS.find((s) => s.code === activeSubject)?.nameVi ?? activeSubject}</strong>
        )}
      </div>

      <div className="composer-cta-block">
        <button type="button" className="cbt-btn cbt-btn-primary composer-cta-btn" onClick={generateOne}>
          Sinh đề chuẩn QĐ764
        </button>
        <p className="admin-hint">
          {composeMode === 'english'
            ? 'Ghép 6 cluster Tiếng Anh theo thứ tự QĐ764 (40 câu, không trộn).'
            : composeMode === 'essay'
              ? 'Lấy 2 bài tự luận Đọc hiểu + Viết từ ngân hàng.'
              : `Tự động chọn câu từ ngân hàng (${qd764Count} câu theo cấu trúc QĐ764).`}
        </p>
        {enabledSubjects.length > 1 && (
          <button type="button" className="cbt-btn cbt-btn-outline" onClick={generateAll}>
            Sinh đề tất cả môn đã bật ({enabledSubjects.length})
          </button>
        )}
      </div>

      {partChecklist.length > 0 && (
        <table className="composer-checklist-table">
          <thead>
            <tr>
              <th>{composeMode === 'english' ? 'Cluster' : 'Phần'}</th>
              <th>Cần</th>
              <th>Đã có</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {partChecklist.map((p) => (
              <tr key={p.partKey} className={p.ok ? 'composer-check-ok' : 'composer-check-fail'}>
                <td>{p.label}{p.extra}</td>
                <td>{p.expected}</td>
                <td>{p.count}</td>
                <td>{p.ok ? '✓ Đủ' : '✗ Thiếu'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {composeMode !== 'english' && (
        <details className="composer-advanced" open={advancedOpen} onToggle={(e) => setAdvancedOpen((e.target as HTMLDetailsElement).open)}>
          <summary>Chọn thủ công thứ tự câu (nâng cao)</summary>
          <p className="admin-hint">Chỉ hiển thị câu của môn đang chọn. Bấm từng câu để thêm vào thứ tự đề.</p>
          <button type="button" className="cbt-btn cbt-btn-outline" onClick={applyManual} disabled={!selected.length}>
            Lưu thứ tự đề ({selected.length} câu)
          </button>
          <ul className="composer-pool-list">
            {pool.map((q) => (
              <li key={q.id}>
                <button
                  type="button"
                  className={`cbt-btn ${selected.includes(q.id) ? 'cbt-btn-primary' : 'cbt-btn-outline'}`}
                  style={{ width: '100%', textAlign: 'left', fontSize: '0.85rem' }}
                  onClick={() => setSelected((prev) => (prev.includes(q.id) ? prev.filter((x) => x !== q.id) : [...prev, q.id]))}
                >
                  {selected.includes(q.id) ? `✓ ${q.stem}` : q.stem || '(chưa có nội dung)'}
                </button>
              </li>
            ))}
            {!pool.length && <li className="admin-hint">Chưa có câu trong ngân hàng môn này.</li>}
          </ul>
        </details>
      )}

      <div className="composer-blueprint-summary">
        <h4>Trạng thái đề theo môn</h4>
        {Object.entries(draft.papers).map(([sub, paper]) => {
          const bp = validateSubjectBlueprint({
            subjectCode: sub,
            paper,
            clusters: draft.clusters,
            mediaManifest: draft.manifest.mediaManifest,
          });
          return (
            <div key={sub} className="composer-blueprint-row">
              <strong>{TN_THPT_SUBJECTS.find((s) => s.code === sub)?.nameVi ?? sub}</strong>
              <span> — {paper.questions.length} câu</span>
              <span className={bp.valid ? 'composer-check-ok-text' : 'composer-check-fail-text'}>
                {bp.valid ? 'Blueprint OK' : bp.errors.join(' · ')}
              </span>
            </div>
          );
        })}
      </div>

      {toast && <ComposerToast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
