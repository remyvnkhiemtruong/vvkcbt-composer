import { useMemo, useState } from 'react';
import { RichTextContent } from '@vnu/web-shared';
import type { ExamPackageExportState, ExamPackageQuestionRow } from '@vnu/shared-types';
import { getSubjectNameVi } from '@vnu/shared-types';
import { uploadMedia } from './api';
import { getPartLabelVi, listPartOptionsVi, TF_BRANCH_HINT } from './composer-labels';
import { ComposerToast } from './ComposerToast';
import { WordImportModal } from './WordImportModal';
import {
  deleteQuestion,
  getBankPartProgress,
  listQuestions,
  mediaToken,
  updateQuestion,
} from './draft';
import { defaultMaxScore } from './questionFormUtils';

const NORMAL_SUBJECTS = [
  'MATH', 'PHYSICS', 'CHEMISTRY', 'BIOLOGY', 'GEOGRAPHY',
  'HISTORY', 'CIVIC_EDU', 'TECH_INDUSTRY', 'TECH_AGRICULTURE', 'INFORMATICS',
] as const;

export function NormalSubjectEditor({
  draft,
  subject,
  onDraftChange,
  onAdd,
}: {
  draft: ExamPackageExportState;
  subject: string;
  onDraftChange: (fn: (d: ExamPackageExportState) => void) => void;
  onAdd: (q: ExamPackageQuestionRow) => void;
}) {
  const partOptions = useMemo(() => listPartOptionsVi(subject), [subject]);
  const [activePart, setActivePart] = useState(partOptions[0]?.key ?? 'part1_mcq');
  const activeCfg = partOptions.find((p) => p.key === activePart);
  const type = activeCfg?.type ?? 'mcq';

  const [stem, setStem] = useState('');
  const [options, setOptions] = useState(['A. ', 'B. ', 'C. ', 'D. ']);
  const [statements, setStatements] = useState(['', '', '', '']);
  const [tfCorrect, setTfCorrect] = useState([true, false, true, false]);
  const [correctKey, setCorrectKey] = useState('A');
  const [orientation, setOrientation] = useState('');
  const [informaticsSlot, setInformaticsSlot] = useState<number | ''>('');
  const [editId, setEditId] = useState<string | null>(null);
  const [wordModalOpen, setWordModalOpen] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);

  const maxScore = defaultMaxScore(subject, type, activePart);
  const bankProgress = getBankPartProgress(draft, subject);
  const bank = listQuestions(draft, subject).filter(
    (q) => q.part === activePart || (!q.part && q.type === type),
  );

  const showToast = (msg: string, t: 'success' | 'error' | 'info' = 'info') => setToast({ msg, type: t });

  const resetForm = () => {
    setEditId(null);
    setStem('');
    setOptions(['A. ', 'B. ', 'C. ', 'D. ']);
    setStatements(['', '', '', '']);
    setTfCorrect([true, false, true, false]);
    setCorrectKey('A');
    setOrientation('');
    setInformaticsSlot('');
  };

  const buildQuestion = (): ExamPackageQuestionRow => {
    const content: Record<string, unknown> = { stem };
    if (type === 'mcq') content.options = options;
    if (type === 'true_false') content.statements = statements;
    if (orientation && subject === 'INFORMATICS' && type === 'true_false') {
      content.orientation = orientation;
    }

    let key: unknown = correctKey;
    if (type === 'true_false') key = tfCorrect;

    return {
      id: editId ?? crypto.randomUUID(),
      subject,
      type,
      part: activePart,
      difficulty: 'medium',
      content,
      correctKey: key,
      maxScore,
      ...(subject === 'INFORMATICS' &&
      activePart === 'part2_true_false' &&
      informaticsSlot !== ''
        ? { informaticsSlot: Number(informaticsSlot) }
        : {}),
    } as ExamPackageQuestionRow & { part?: string };
  };

  const save = () => {
    const q = buildQuestion();
    if (editId) {
      onDraftChange((d) => updateQuestion(d, q));
      showToast('Đã lưu câu hỏi', 'success');
    } else {
      onAdd(q);
      showToast('Đã thêm câu hỏi', 'success');
    }
    resetForm();
  };

  const loadEdit = (q: ExamPackageQuestionRow & { part?: string }) => {
    setEditId(q.id);
    setStem(String(q.content?.stem ?? ''));
    if (q.content?.options) setOptions(q.content.options as string[]);
    if (q.content?.statements) setStatements(q.content.statements as string[]);
    if (q.type === 'true_false' && Array.isArray(q.correctKey)) {
      setTfCorrect(q.correctKey as boolean[]);
    } else {
      setCorrectKey(String(q.correctKey ?? 'A'));
    }
    setOrientation(String((q.content as { orientation?: string })?.orientation ?? ''));
    setInformaticsSlot(
      subject === 'INFORMATICS' && (q as ExamPackageQuestionRow).informaticsSlot != null
        ? (q as ExamPackageQuestionRow).informaticsSlot!
        : '',
    );
  };

  const uploadFile = async (file: File, kind: 'image' | 'audio') => {
    try {
      const { registerMediaFile } = await import('./draft');
      await uploadMedia(file);
      const next = structuredClone(draft);
      const zipPath = await registerMediaFile(next, file);
      onDraftChange((d) => {
        d.mediaFiles = next.mediaFiles;
        d.manifest.mediaManifest = next.manifest.mediaManifest;
      });
      setStem((s) => `${s}\n${mediaToken(zipPath, kind)}`.trim());
      showToast('Đã chèn media', 'success');
    } catch {
      showToast('Upload thất bại', 'error');
    }
  };

  const canWordImport = type === 'mcq' || type === 'short_answer';

  return (
    <div className="composer-normal-layout">
      <aside className="composer-normal-sidebar">
        <h4>Ma trận ngân hàng — {getSubjectNameVi(subject)}</h4>
        <table className="composer-checklist-table">
          <thead>
            <tr><th>Phần</th><th>Cần</th><th>Có</th><th /></tr>
          </thead>
          <tbody>
            {bankProgress.map((p) => (
              <tr
                key={p.partKey}
                className={`composer-matrix-row ${p.partKey === activePart ? 'active' : ''} ${p.ok ? 'composer-check-ok' : 'composer-check-fail'}`}
                onClick={() => setActivePart(p.partKey)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && setActivePart(p.partKey)}
              >
                <td>{getPartLabelVi(subject, p.partKey).replace(/^Phần \d+ — /, 'P')}</td>
                <td>{p.expected}</td>
                <td>{p.count}</td>
                <td>{p.ok ? '✓' : '✗'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {subject === 'INFORMATICS' && activePart === 'part2_true_false' && (
          <p className="admin-hint">Phần II: 6 câu Đ/S (2 chung + 2 KHMT + 2 THUD). Ghi chú định hướng tùy chọn trên từng câu.</p>
        )}
      </aside>

      <div className="composer-normal-main">
        <div className="composer-part-tabs">
          {partOptions.map((p) => (
            <button
              key={p.key}
              type="button"
              className={`cbt-btn ${activePart === p.key ? 'cbt-btn-primary' : 'cbt-btn-outline'}`}
              onClick={() => { setActivePart(p.key); resetForm(); }}
            >
              {getPartLabelVi(subject, p.key).replace(/^Phần (\d+)/, 'Phần $1')}
            </button>
          ))}
        </div>

        <div className="composer-row" style={{ marginBottom: '0.5rem' }}>
          {canWordImport && (
            <button type="button" className="cbt-btn cbt-btn-outline" onClick={() => setWordModalOpen(true)}>
              Nhập từ Word
            </button>
          )}
          <button type="button" className="cbt-btn cbt-btn-outline" onClick={() => setStem((s) => `${s} $$x^2$$`)}>KaTeX</button>
          <label className="cbt-btn cbt-btn-outline" style={{ cursor: 'pointer' }}>
            Ảnh
            <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0], 'image')} />
          </label>
          {editId && <button type="button" className="cbt-btn cbt-btn-outline" onClick={resetForm}>Hủy sửa</button>}
        </div>

        {type === 'true_false' && (
          <p className="admin-hint composer-tf-hint">{TF_BRANCH_HINT}</p>
        )}

        {type === 'mcq' && (
          <>
            <textarea className="cbt-textarea editor-area" rows={3} value={stem} onChange={(e) => setStem(e.target.value)} placeholder="Nội dung câu" />
            {options.map((opt, i) => (
              <input key={i} className="cbt-input" style={{ display: 'block', marginBottom: '0.25rem' }} value={opt}
                onChange={(e) => { const next = [...options]; next[i] = e.target.value; setOptions(next); }} />
            ))}
            <select className="cbt-select" value={correctKey} onChange={(e) => setCorrectKey(e.target.value)}>
              {['A', 'B', 'C', 'D'].map((k) => <option key={k} value={k}>{k} đúng</option>)}
            </select>
          </>
        )}

        {type === 'true_false' && (
          <>
            <textarea className="cbt-textarea" rows={2} value={stem} onChange={(e) => setStem(e.target.value)} placeholder="Bối cảnh / câu dẫn (tùy chọn)" />
            {subject === 'INFORMATICS' && activePart === 'part2_true_false' && (
              <label className="composer-row" style={{ marginBottom: '0.5rem' }}>
                Slot Phần II (1–6)
                <select
                  className="cbt-select"
                  value={informaticsSlot === '' ? '' : String(informaticsSlot)}
                  onChange={(e) => setInformaticsSlot(e.target.value ? Number(e.target.value) : '')}
                >
                  <option value="">— Chọn slot —</option>
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={n}>
                      Slot {n}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {subject === 'INFORMATICS' && (
              <input className="cbt-input" value={orientation} onChange={(e) => setOrientation(e.target.value)}
                placeholder="Định hướng: chung / KHMT / THUD (tùy chọn)" style={{ marginBottom: '0.5rem' }} />
            )}
            {statements.map((st, i) => (
              <div key={i} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <input className="cbt-input" style={{ flex: 1 }} value={st} onChange={(e) => {
                  const next = [...statements]; next[i] = e.target.value; setStatements(next);
                }} placeholder={`Mệnh đề ${i + 1}`} />
                <select className="cbt-select" value={tfCorrect[i] ? 'true' : 'false'} onChange={(e) => {
                  const next = [...tfCorrect]; next[i] = e.target.value === 'true'; setTfCorrect(next);
                }}>
                  <option value="true">Đúng</option>
                  <option value="false">Sai</option>
                </select>
              </div>
            ))}
          </>
        )}

        {type === 'short_answer' && (
          <>
            <textarea className="cbt-textarea editor-area" rows={3} value={stem} onChange={(e) => setStem(e.target.value)} placeholder="Nội dung câu" />
            <input className="cbt-input" value={String(correctKey)} onChange={(e) => setCorrectKey(e.target.value)} placeholder="Đáp án đúng" />
          </>
        )}

        <div className="composer-row" style={{ marginTop: '0.5rem' }}>
          <span className="admin-hint">Điểm: {maxScore}</span>
          <button type="button" className="cbt-btn cbt-btn-primary" onClick={save}>{editId ? 'Lưu' : 'Thêm câu'}</button>
        </div>

        {stem && type !== 'true_false' && (
          <div style={{ marginTop: '0.5rem', padding: '0.75rem', background: '#f8fafc', borderRadius: 8 }}>
            <RichTextContent content={stem} />
          </div>
        )}

        <h4 style={{ marginTop: '1rem' }}>Câu trong {getPartLabelVi(subject, activePart)} ({bank.length})</h4>
        <ul className="composer-bank-list">
          {bank.map((q) => (
            <li key={q.id}>
              <span className="composer-bank-stem">{String((q.content as { stem?: string })?.stem ?? '').slice(0, 70)}</span>
              <button type="button" className="cbt-btn cbt-btn-outline" onClick={() => loadEdit(q as ExamPackageQuestionRow & { part?: string })}>Sửa</button>
              <button type="button" className="cbt-btn cbt-btn-outline" onClick={() => onDraftChange((d) => deleteQuestion(d, q.id))}>Xóa</button>
            </li>
          ))}
          {!bank.length && <li className="admin-hint">Chưa có câu trong phần này.</li>}
        </ul>
      </div>

      {wordModalOpen && (
        <WordImportModal
          draft={draft}
          defaultSubject={subject}
          defaultPart={activePart}
          onClose={() => setWordModalOpen(false)}
          onImport={(qs) => { for (const q of qs) onAdd(q); showToast(`Đã thêm ${qs.length} câu`, 'success'); }}
          onToast={showToast}
        />
      )}
      {toast && <ComposerToast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

export { NORMAL_SUBJECTS };
