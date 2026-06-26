import { useState } from 'react';
import type { ExamPackageExportState, ExamPackageQuestionRow } from '@vnu/shared-types';
import { TN_THPT_SUBJECTS } from '@vnu/shared-types';
import { listPartOptionsVi } from './composer-labels';
import { getDefaultPartForType } from './draft';
import {
  extractTextFromDocx,
  parseWordText,
  toExamQuestions,
  type ParsedWordQuestion,
} from './wordImport';

export function WordImportModal({
  draft,
  defaultSubject,
  defaultPart,
  onClose,
  onImport,
  onToast,
}: {
  draft: ExamPackageExportState;
  defaultSubject: string;
  defaultPart?: string;
  onClose: () => void;
  onImport: (questions: ExamPackageQuestionRow[]) => void;
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}) {
  const [subject, setSubject] = useState(defaultSubject);
  const [part, setPart] = useState(() => defaultPart ?? getDefaultPartForType(defaultSubject, 'mcq') ?? 'part1_mcq');
  const [text, setText] = useState('');
  const [preview, setPreview] = useState<ParsedWordQuestion[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const partOptions = listPartOptionsVi(subject);

  const runParse = (raw: string) => {
    const result = parseWordText(raw);
    setPreview(result.questions);
    setErrors(result.errors);
  };

  const handleFile = async (file: File) => {
    setBusy(true);
    try {
      const extracted = await extractTextFromDocx(file);
      setText(extracted);
      runParse(extracted);
    } catch {
      onToast('Không đọc được file Word', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleImport = () => {
    if (!preview.length) {
      onToast('Chưa có câu hỏi để thêm', 'error');
      return;
    }
    const partCfg = partOptions.find((p) => p.key === part);
    const defaultScore = partCfg?.type === 'mcq' ? 0.25 : 0.25;
    const questions = toExamQuestions(preview, subject, part, defaultScore);
    onImport(questions);
    onToast(`Đã thêm ${questions.length} câu vào ngân hàng`, 'success');
    onClose();
  };

  return (
    <div className="composer-modal-backdrop" onClick={onClose} role="presentation">
      <div className="composer-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="word-import-title">
        <h3 id="word-import-title">Nhập từ Word / dán đề</h3>
        <p className="admin-hint">
          Mẫu: Câu 1. Nội dung… A. … B. … C. … D. … Đáp án: B (tối đa 200 câu/lần)
        </p>
        <div className="composer-row">
          <label>Môn</label>
          <select className="cbt-select" value={subject} onChange={(e) => {
            setSubject(e.target.value);
            const p = getDefaultPartForType(e.target.value, 'mcq') ?? 'part1_mcq';
            setPart(p);
          }}>
            {TN_THPT_SUBJECTS.map((s) => (
              <option key={s.code} value={s.code}>{s.nameVi}</option>
            ))}
          </select>
          <label>Phần đề</label>
          <select className="cbt-select" value={part} onChange={(e) => setPart(e.target.value)}>
            {partOptions.map((p) => (
              <option key={p.key} value={p.key}>{p.label}</option>
            ))}
          </select>
        </div>
        <label className="cbt-btn cbt-btn-outline" style={{ cursor: 'pointer', display: 'inline-block' }}>
          Chọn file .docx
          <input type="file" accept=".docx" hidden disabled={busy} onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
        </label>
        <textarea
          className="cbt-textarea"
          rows={8}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Dán nội dung từ Word vào đây…"
          style={{ width: '100%', marginTop: '0.5rem' }}
        />
        <div className="composer-row" style={{ marginTop: '0.5rem' }}>
          <button type="button" className="cbt-btn cbt-btn-outline" onClick={() => runParse(text)} disabled={!text.trim()}>
            Xem trước
          </button>
          <button type="button" className="cbt-btn cbt-btn-primary" onClick={handleImport} disabled={!preview.length}>
            Thêm vào ngân hàng ({preview.length})
          </button>
          <button type="button" className="cbt-btn cbt-btn-outline" onClick={onClose}>Đóng</button>
        </div>
        {errors.length > 0 && (
          <ul className="composer-parse-errors">
            {errors.map((err, i) => <li key={i}>{err}</li>)}
          </ul>
        )}
        {preview.length > 0 && (
          <ul className="composer-parse-preview">
            {preview.slice(0, 10).map((q, i) => (
              <li key={i}>{q.stem.slice(0, 80)}{q.stem.length > 80 ? '…' : ''}</li>
            ))}
            {preview.length > 10 && <li>… và {preview.length - 10} câu nữa</li>}
          </ul>
        )}
      </div>
    </div>
  );
}
